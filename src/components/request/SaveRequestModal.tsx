import React, { useEffect, useState } from "react";
import { Button, Input, Modal, Select, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { Collection, HttpRequest } from "../../types";
import * as db from "../../services/database";

interface SaveRequestModalProps {
  open: boolean;
  tabId: string;
  request: HttpRequest;
  suggestedName: string;
  workspaceId: string | null;
  preferredCollectionId: string | null;
  onCancel: () => void;
  onSaved: (
    tabId: string,
    itemId: string,
    collectionId: string,
    name: string
  ) => void;
}

export const SaveRequestModal: React.FC<SaveRequestModalProps> = ({
  open,
  tabId,
  request,
  suggestedName,
  workspaceId,
  preferredCollectionId,
  onCancel,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [requestName, setRequestName] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);

  const loadCollections = async (preferredId?: string | null) => {
    if (!workspaceId) {
      setCollections([]);
      setCollectionId(null);
      return;
    }

    try {
      const list = await db.listCollections(workspaceId);
      setCollections(list);
      const selectedId = preferredId || collectionId;
      const existingId =
        selectedId && list.some((collection) => collection.id === selectedId)
          ? selectedId
          : null;
      setCollectionId(existingId || list[0]?.id || null);
    } catch {
      setCollections([]);
      setCollectionId(null);
      message.error(t("collection.loadFailed"));
    }
  };

  useEffect(() => {
    if (!open) return;
    setRequestName(suggestedName);
    setNewCollectionName("");
    void loadCollections(preferredCollectionId);
  }, [open, preferredCollectionId, suggestedName, workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!workspaceId || !name) return;

    setCreatingCollection(true);
    try {
      const id = await db.createCollection(workspaceId, name);
      setNewCollectionName("");
      await loadCollections(id);
      window.dispatchEvent(
        new CustomEvent("mini-postman:collection-updated", {
          detail: { collectionId: id },
        })
      );
    } catch (error) {
      message.error(
        db.isDuplicateCollectionNameError(error)
          ? t("collection.nameExists")
          : t("collection.createFailed")
      );
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleSave = async () => {
    const name = requestName.trim();
    if (!name) {
      message.warning(t("common.name"));
      return;
    }
    if (!workspaceId || !collectionId) {
      message.warning(t("request.selectCollection"));
      return;
    }

    setSaving(true);
    try {
      const collection = await db.getCollection(collectionId);
      if (!collection || collection.workspace_id !== workspaceId) {
        message.error(t("request.parentCollectionMissing"));
        await loadCollections();
        return;
      }

      const itemId = await db.createCollectionItem({
        collection_id: collectionId,
        parent_id: null,
        type: "request",
        name,
        method: request.method,
        url: request.url,
        headers: JSON.stringify(request.headers),
        query_params: JSON.stringify(request.queryParams),
        body_mode: request.bodyMode,
        body_content: request.bodyContent,
        auth_type: request.authType,
        auth_config: JSON.stringify(request.authConfig),
      });
      onSaved(tabId, itemId, collectionId, name);
    } catch {
      message.error(t("request.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t("request.saveToCollection")}
      open={open}
      onCancel={onCancel}
      onOk={handleSave}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      width={460}
    >
      <div className="save-request-modal-content">
        <label className="save-request-field">
          <span>{t("common.name")}</span>
          <Input
            value={requestName}
            onChange={(event) => setRequestName(event.target.value)}
            onPressEnter={() => void handleSave()}
            autoFocus
          />
        </label>

        <label className="save-request-field">
          <span>{t("collection.title")}</span>
          <Select
            value={collectionId || undefined}
            onChange={setCollectionId}
            placeholder={t("request.selectCollection")}
            options={collections.map((collection) => ({
              value: collection.id,
              label: collection.name,
            }))}
          />
        </label>

        <div className="save-request-quick-collection">
          <Input
            size="small"
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            onPressEnter={() => void handleCreateCollection()}
            placeholder={t("request.newCollectionName")}
          />
          <Button
            size="small"
            icon={<PlusOutlined />}
            loading={creatingCollection}
            disabled={!newCollectionName.trim()}
            onClick={() => void handleCreateCollection()}
            title={t("collection.create")}
            aria-label={t("collection.create")}
          />
        </div>
      </div>
    </Modal>
  );
};
