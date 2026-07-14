import React, { useCallback, useEffect, useState } from "react";
import { Button, Input, Modal, Select, Spin, Tag, message } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type {
  AuthType,
  Collection,
  RequestAuthConfig,
} from "../../types";
import {
  defaultAuthConfig,
  normalizeAuthType,
  parseAuthConfig,
} from "../../services/auth";
import * as db from "../../services/database";

type DirectAuthType = Exclude<AuthType, "inherit">;

interface AuthEditorProps {
  authType: AuthType;
  authConfig: RequestAuthConfig;
  collectionId: string | null;
  onChange: (authType: AuthType, authConfig: RequestAuthConfig) => void;
}

export const AuthEditor: React.FC<AuthEditorProps> = ({
  authType,
  authConfig,
  collectionId,
  onChange,
}) => {
  const { t } = useTranslation();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [editingCollection, setEditingCollection] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [collectionAuthType, setCollectionAuthType] =
    useState<DirectAuthType>("none");
  const [collectionAuthConfig, setCollectionAuthConfig] =
    useState<RequestAuthConfig>({});

  const requestAuthOptions = [
    { value: "none", label: t("request.authType.none") },
    { value: "inherit", label: t("request.authType.inherit") },
    { value: "basic", label: t("request.authType.basic") },
    { value: "bearer", label: t("request.authType.bearer") },
    { value: "apikey", label: t("request.authType.apikey") },
  ];

  const directAuthOptions = requestAuthOptions.filter(
    (option) => option.value !== "inherit"
  );

  const authTypeLabel = (type: AuthType) =>
    requestAuthOptions.find((option) => option.value === type)?.label ||
    t("request.authType.none");

  const loadCollection = useCallback(async () => {
    if (!collectionId) {
      setCollection(null);
      return;
    }

    setLoadingCollection(true);
    try {
      setCollection(await db.getCollection(collectionId));
    } catch {
      setCollection(null);
      message.error(t("request.collectionAuthLoadFailed"));
    } finally {
      setLoadingCollection(false);
    }
  }, [collectionId, t]);

  useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

  const changeAuthType = (nextType: AuthType) => {
    onChange(
      nextType,
      nextType === authType ? authConfig : defaultAuthConfig(nextType)
    );
  };

  const updateRequestConfig = (updates: Partial<RequestAuthConfig>) => {
    onChange(authType, { ...authConfig, ...updates });
  };

  const openCollectionEditor = () => {
    if (!collection) return;
    const normalized = normalizeAuthType(collection.auth_type);
    const directType: DirectAuthType =
      normalized === "inherit" ? "none" : normalized;
    setCollectionAuthType(directType);
    setCollectionAuthConfig(parseAuthConfig(collection.auth_config));
    setEditingCollection(true);
  };

  const changeCollectionAuthType = (nextType: DirectAuthType) => {
    setCollectionAuthType(nextType);
    setCollectionAuthConfig(defaultAuthConfig(nextType));
  };

  const saveCollectionAuth = async () => {
    if (!collection) return;
    setSavingCollection(true);
    try {
      await db.updateCollection(collection.id, {
        auth_type: collectionAuthType,
        auth_config: JSON.stringify(collectionAuthConfig),
      });
      setEditingCollection(false);
      await loadCollection();
      message.success(t("request.collectionAuthSaved"));
    } catch {
      message.error(t("request.collectionAuthSaveFailed"));
    } finally {
      setSavingCollection(false);
    }
  };

  const renderAuthFields = (
    type: AuthType,
    config: RequestAuthConfig,
    updateConfig: (updates: Partial<RequestAuthConfig>) => void
  ) => {
    if (type === "basic") {
      return (
        <div className="auth-fields">
          <label className="auth-field">
            <span>{t("request.authUsername")}</span>
            <Input
              size="small"
              value={config.username || ""}
              onChange={(event) => updateConfig({ username: event.target.value })}
              autoComplete="username"
            />
          </label>
          <label className="auth-field">
            <span>{t("request.authPassword")}</span>
            <Input.Password
              size="small"
              value={config.password || ""}
              onChange={(event) => updateConfig({ password: event.target.value })}
              autoComplete="current-password"
            />
          </label>
        </div>
      );
    }

    if (type === "bearer") {
      return (
        <div className="auth-fields">
          <label className="auth-field">
            <span>{t("request.authToken")}</span>
            <Input.Password
              size="small"
              value={config.token || ""}
              onChange={(event) => updateConfig({ token: event.target.value })}
              autoComplete="off"
            />
          </label>
        </div>
      );
    }

    if (type === "apikey") {
      return (
        <div className="auth-fields auth-fields-grid">
          <label className="auth-field">
            <span>{t("request.authKey")}</span>
            <Input
              size="small"
              value={config.key || ""}
              onChange={(event) => updateConfig({ key: event.target.value })}
            />
          </label>
          <label className="auth-field">
            <span>{t("request.authValue")}</span>
            <Input.Password
              size="small"
              value={config.value || ""}
              onChange={(event) => updateConfig({ value: event.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="auth-field">
            <span>{t("request.authAddTo")}</span>
            <Select
              size="small"
              value={config.addTo || "header"}
              onChange={(addTo) => updateConfig({ addTo })}
              options={[
                { value: "header", label: t("request.authHeader") },
                { value: "queryParams", label: t("request.authQuery") },
              ]}
            />
          </label>
        </div>
      );
    }

    return null;
  };

  const inheritedType = collection
    ? normalizeAuthType(collection.auth_type)
    : "none";

  return (
    <div className="auth-editor">
      <label className="auth-field auth-type-field">
        <span>{t("request.auth")}</span>
        <Select
          size="small"
          value={authType}
          onChange={changeAuthType}
          options={requestAuthOptions}
        />
      </label>

      {authType === "inherit" ? (
        <div className="auth-inherit-panel">
          {loadingCollection ? (
            <Spin size="small" />
          ) : collection ? (
            <>
              <div className="auth-inherit-summary">
                <div>
                  <span className="auth-inherit-label">
                    {t("request.authInheritedFrom", { name: collection.name })}
                  </span>
                  <Tag>{authTypeLabel(inheritedType)}</Tag>
                </div>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={openCollectionEditor}
                >
                  {t("request.editCollectionAuth")}
                </Button>
              </div>
            </>
          ) : (
            <span className="auth-inherit-empty">
              {t("request.authNoCollection")}
            </span>
          )}
        </div>
      ) : (
        renderAuthFields(authType, authConfig, updateRequestConfig)
      )}

      <Modal
        title={t("request.collectionAuth")}
        open={editingCollection}
        onCancel={() => setEditingCollection(false)}
        onOk={saveCollectionAuth}
        confirmLoading={savingCollection}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        width={460}
      >
        <div className="collection-auth-modal-content">
          <label className="auth-field">
            <span>{t("request.auth")}</span>
            <Select
              value={collectionAuthType}
              onChange={changeCollectionAuthType}
              options={directAuthOptions}
            />
          </label>
          {renderAuthFields(
            collectionAuthType,
            collectionAuthConfig,
            (updates) =>
              setCollectionAuthConfig((current) => ({ ...current, ...updates }))
          )}
        </div>
      </Modal>
    </div>
  );
};
