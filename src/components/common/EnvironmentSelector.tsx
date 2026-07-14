import React, { useEffect, useState } from "react";
import { Button, Input, Modal, Select, Spin, Tabs, message } from "antd";
import {
  DeleteOutlined,
  GlobalOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useEnvironment } from "../../contexts/EnvironmentContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useTab } from "../../contexts/TabContext";
import { KeyValueTable } from "../request/KeyValueTable";
import { emptyKeyValue } from "../../utils/keyValue";
import type { KeyValue } from "../../types";
import * as db from "../../services/database";

type VariableScope = "environment" | "collection" | "global";
type EditableVariable = KeyValue & { id: string; isSecret?: number };

const newVariable = (): EditableVariable => ({
  ...emptyKeyValue(),
  id: crypto.randomUUID(),
});

export const EnvironmentSelector: React.FC = () => {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const { activeTab } = useTab();
  const {
    environments,
    activeEnvId,
    setActiveEnvId,
    reloadActiveVariables,
    createEnvironment,
    deleteEnvironment,
  } = useEnvironment();
  const [managerOpen, setManagerOpen] = useState(false);
  const [scope, setScope] = useState<VariableScope>("environment");
  const [rows, setRows] = useState<EditableVariable[]>([newVariable()]);
  const [persistedIds, setPersistedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEnvironmentName, setNewEnvironmentName] = useState("");
  const [creating, setCreating] = useState(false);
  const noEnvironmentLabel = t("environment.noEnv");

  const ownerId =
    scope === "environment"
      ? activeEnvId
      : scope === "collection"
        ? activeTab?.collectionId || null
        : activeWorkspace?.id || null;

  useEffect(() => {
    if (!managerOpen || !ownerId) {
      setRows([newVariable()]);
      setPersistedIds([]);
      setLoadFailed(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    const load = async () => {
      const records =
        scope === "environment"
          ? await db.listEnvVariables(ownerId)
          : scope === "collection"
            ? await db.listCollectionVariables(ownerId)
            : await db.listGlobalVariables(ownerId);
      if (cancelled) return;
      const nextRows = records.map((record) => ({
        id: record.id,
        key: record.key,
        value: record.value,
        enabled: Boolean(record.enabled),
        ...(scope === "environment"
          ? { isSecret: "is_secret" in record ? record.is_secret : 0 }
          : {}),
      }));
      setRows(nextRows.length > 0 ? nextRows : [newVariable()]);
      setPersistedIds(records.map((record) => record.id));
    };

    void load()
      .catch(() => {
        if (!cancelled) {
          setRows([newVariable()]);
          setPersistedIds([]);
          setLoadFailed(true);
          message.error(t("environment.variablesLoadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [managerOpen, ownerId, scope, t]);

  const handleRowsChange = (nextRows: KeyValue[]) => {
    setRows(
      nextRows.map((row) => ({
        ...row,
        id:
          "id" in row && typeof row.id === "string"
            ? row.id
            : crypto.randomUUID(),
        isSecret:
          "isSecret" in row && typeof row.isSecret === "number"
            ? row.isSecret
            : 0,
      }))
    );
  };

  const handleSave = async () => {
    if (!ownerId) return;
    const activeRows = rows.filter((row) => row.key.trim());
    const activeIds = new Set(activeRows.map((row) => row.id));
    setSaving(true);
    try {
      for (const id of persistedIds) {
        if (activeIds.has(id)) continue;
        if (scope === "environment") await db.deleteEnvVariable(id);
        else if (scope === "collection") {
          await db.deleteCollectionVariable(id);
        } else {
          await db.deleteGlobalVariable(id);
        }
      }

      for (const [index, row] of activeRows.entries()) {
        if (scope === "environment") {
          await db.upsertEnvVariable({
            id: row.id,
            environment_id: ownerId,
            key: row.key.trim(),
            value: row.value,
            enabled: row.enabled ? 1 : 0,
            is_secret: row.isSecret || 0,
            sort_order: index,
          });
        } else if (scope === "collection") {
          await db.upsertCollectionVariable({
            id: row.id,
            collection_id: ownerId,
            key: row.key.trim(),
            value: row.value,
            enabled: row.enabled ? 1 : 0,
            sort_order: index,
          });
        } else {
          await db.upsertGlobalVariable({
            id: row.id,
            workspace_id: ownerId,
            key: row.key.trim(),
            value: row.value,
            enabled: row.enabled ? 1 : 0,
            sort_order: index,
          });
        }
      }

      setPersistedIds(activeRows.map((row) => row.id));
      if (scope === "environment") await reloadActiveVariables();
      message.success(t("environment.variablesSaved"));
    } catch {
      message.error(t("environment.variablesSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEnvironment = async () => {
    const name = newEnvironmentName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const id = await createEnvironment(name);
      setActiveEnvId(id);
      setNewEnvironmentName("");
    } catch {
      message.error(t("environment.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEnvironment = () => {
    if (!activeEnvId) return;
    Modal.confirm({
      title: t("environment.deleteConfirm"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteEnvironment(activeEnvId);
        } catch {
          message.error(t("environment.deleteFailed"));
          throw new Error("ENVIRONMENT_DELETE_FAILED");
        }
      },
    });
  };

  const scopeContent = (hint: string) => (
    <div className="variable-scope-editor">
      <p className="variable-scope-hint">{hint}</p>
      {loading ? (
        <div className="variable-scope-loading">
          <Spin size="small" />
        </div>
      ) : ownerId ? (
        <KeyValueTable rows={rows} onChange={handleRowsChange} />
      ) : (
        <p className="variable-scope-empty">
          {t("environment.scopeUnavailable")}
        </p>
      )}
    </div>
  );

  return (
    <>
      <div className="environment-selector-row">
        <Select
          value={activeEnvId ?? undefined}
          onChange={(val) => setActiveEnvId(val || null)}
          placeholder={noEnvironmentLabel}
          allowClear
          size="small"
          className="environment-select"
          suffixIcon={<GlobalOutlined />}
          title={noEnvironmentLabel}
          notFoundContent={noEnvironmentLabel}
          options={environments.map((env) => ({
            value: env.id,
            label: env.name,
          }))}
        />
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => setManagerOpen(true)}
          title={t("environment.manage")}
          aria-label={t("environment.manage")}
        />
      </div>

      <Modal
        title={t("environment.manage")}
        open={managerOpen}
        onCancel={() => setManagerOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={t("common.save")}
        cancelText={t("common.close")}
        okButtonProps={{ disabled: !ownerId || loading || loadFailed }}
        width={720}
      >
        <Tabs
          activeKey={scope}
          onChange={(key) => setScope(key as VariableScope)}
          items={[
            {
              key: "environment",
              label: t("environment.environmentScope"),
              children: (
                <>
                  <div className="environment-manager-actions">
                    <Input
                      size="small"
                      value={newEnvironmentName}
                      onChange={(event) =>
                        setNewEnvironmentName(event.target.value)
                      }
                      onPressEnter={() => void handleCreateEnvironment()}
                      placeholder={t("environment.newName")}
                    />
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      loading={creating}
                      disabled={!newEnvironmentName.trim()}
                      onClick={() => void handleCreateEnvironment()}
                    >
                      {t("environment.create")}
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={!activeEnvId}
                      onClick={handleDeleteEnvironment}
                    />
                  </div>
                  {scopeContent(
                    activeEnvId
                      ? t("environment.environmentScopeHint")
                      : t("environment.selectOrCreate")
                  )}
                </>
              ),
            },
            {
              key: "collection",
              label: t("environment.collectionScope"),
              children: scopeContent(
                activeTab?.collectionId
                  ? t("environment.collectionScopeHint", {
                      name: activeTab.title,
                    })
                  : t("environment.collectionScopeMissing")
              ),
            },
            {
              key: "global",
              label: t("environment.globalScope"),
              children: scopeContent(t("environment.globalScopeHint")),
            },
          ]}
        />
      </Modal>
    </>
  );
};
