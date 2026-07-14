import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Tree,
  Button,
  Dropdown,
  Modal,
  Input,
  Empty,
  Tooltip,
  message,
} from "antd";
import type { MenuProps } from "antd";
import {
  PlusOutlined,
  FolderOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  FolderAddOutlined,
  FileAddOutlined,
  ImportOutlined,
  ExportOutlined,
  UploadOutlined,
  SnippetsOutlined,
} from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useTab } from "../../contexts/TabContext";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Collection, CollectionItem } from "../../types";
import * as db from "../../services/database";
import { normalizeAuthType, parseAuthConfig } from "../../services/auth";
import { METHOD_COLORS } from "../../constants/http";
import { parseKeyValueRows } from "../../utils/keyValue";
import {
  exportWorkspaceCollections,
  importCollectionsFromText,
} from "../../services/importExport";

interface CollectionTreeProps {
  searchText: string;
}

type RenameTarget =
  | { type: "collection"; id: string; name: string }
  | { type: "item"; id: string; name: string };

function exportFileName(workspaceName: string): string {
  const slug = workspaceName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `mini-postman-${slug || "workspace"}-${date}.json`;
}

function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, [contenteditable='true'], .monaco-editor")
  );
}

export const CollectionTree: React.FC<CollectionTreeProps> = ({
  searchText,
}) => {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const { openTab, tabs, updateTab, closeTabs } = useTab();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, CollectionItem[]>>(
    {}
  );
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renaming, setRenaming] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importContent, setImportContent] = useState("");
  const [readingImportFile, setReadingImportFile] = useState(false);
  const [readingClipboard, setReadingClipboard] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importLockRef = useRef(false);

  const reload = useCallback(async () => {
    if (!activeWorkspace) {
      setCollections([]);
      setItemsMap({});
      return;
    }
    try {
      const cols = await db.listCollections(activeWorkspace.id);
      const itemEntries = await Promise.all(
        cols.map(async (collection) => [
          collection.id,
          await db.listCollectionItems(collection.id),
        ] as const)
      );
      setCollections(cols);
      setItemsMap(Object.fromEntries(itemEntries));
    } catch {
      setCollections([]);
      setItemsMap({});
      message.error(t("collection.loadFailed"));
    }
  }, [activeWorkspace, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleExport = async () => {
    if (!activeWorkspace || exporting) return;

    setExporting(true);
    try {
      const fileName = exportFileName(activeWorkspace.name);
      const filePath = await save({
        title: t("collection.exportDialogTitle"),
        defaultPath: fileName,
        filters: [
          {
            name: t("collection.exportJsonFilter"),
            extensions: ["json"],
          },
        ],
      });
      if (!filePath) return;

      const data = await exportWorkspaceCollections(activeWorkspace.id);
      await writeTextFile(filePath, JSON.stringify(data, null, 2));
      message.success(
        t("collection.exportSuccess", {
          count: data.collections.length,
          filePath,
        })
      );
    } catch {
      message.error(t("collection.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || readingImportFile) return;

    setReadingImportFile(true);
    try {
      const content = await file.text();
      if (!content.trim()) {
        message.warning(t("collection.importEmpty"));
        return;
      }
      setImportContent(content);
    } catch {
      message.error(t("collection.importFileFailed"));
    } finally {
      input.value = "";
      setReadingImportFile(false);
    }
  };

  const handleReadClipboard = async () => {
    if (!activeWorkspace || importing || readingImportFile || readingClipboard) {
      return;
    }

    setReadingClipboard(true);
    try {
      const content = await navigator.clipboard.readText();
      if (!content.trim()) {
        message.warning(t("collection.importClipboardEmpty"));
        return;
      }
      setImportContent(content);
    } catch {
      message.error(t("collection.importClipboardFailed"));
    } finally {
      setReadingClipboard(false);
    }
  };

  const closeImportModal = () => {
    if (importing || readingImportFile || readingClipboard) return;
    setShowImportModal(false);
    setImportContent("");
  };

  const handleImport = async (
    contentOverride?: string,
    revealEditorOnError = false
  ) => {
    const content = contentOverride ?? importContent;
    if (
      !activeWorkspace ||
      importLockRef.current ||
      importing ||
      readingImportFile ||
      readingClipboard
    ) {
      return;
    }
    if (!content.trim()) {
      message.warning(t("collection.importEmpty"));
      return;
    }

    importLockRef.current = true;
    setImporting(true);
    try {
      const result = await importCollectionsFromText(
        activeWorkspace.id,
        content
      );
      setExpandedKeys((keys) =>
        Array.from(
          new Set([
            ...keys,
            ...result.collectionIds.map((id) => `col-${id}`),
          ])
        )
      );
      await reload();
      setShowImportModal(false);
      setImportContent("");
      if (result.firstRequestId) {
        await handleOpenRequest(result.firstRequestId);
      }
      message.success(
        t("collection.importSuccess", {
          collectionCount: result.collectionCount,
          requestCount: result.requestCount,
        })
      );
    } catch (error) {
      if (revealEditorOnError) {
        setImportContent(content);
        setShowImportModal(true);
      }
      const errorCode = error instanceof Error ? error.message : "";
      if (errorCode === "UNSUPPORTED_IMPORT_FORMAT") {
        message.error(t("collection.importUnsupported"));
      } else if (
        errorCode === "INVALID_YAML" ||
        errorCode === "IMPORT_CONTENT_EMPTY"
      ) {
        message.error(t("collection.importInvalid"));
      } else {
        message.error(t("collection.importFailed"));
      }
    } finally {
      importLockRef.current = false;
      setImporting(false);
    }
  };

  useEffect(() => {
    const handleCollectionUpdate = (event: Event) => {
      const collectionId = (
        event as CustomEvent<{ collectionId?: string }>
      ).detail?.collectionId;
      if (collectionId) {
        setExpandedKeys((keys) =>
          Array.from(new Set([...keys, `col-${collectionId}`]))
        );
      }
      void reload();
    };
    window.addEventListener(
      "mini-postman:collection-updated",
      handleCollectionUpdate
    );
    return () =>
      window.removeEventListener(
        "mini-postman:collection-updated",
        handleCollectionUpdate
      );
  }, [reload]);

  const handleCreateCollection = async () => {
    if (!activeWorkspace) return;
    const name = newCollectionName.trim();
    if (!name) {
      message.warning(t("common.name"));
      return;
    }
    try {
      const collectionId = await db.createCollection(activeWorkspace.id, name);
      setExpandedKeys((keys) =>
        Array.from(new Set([...keys, `col-${collectionId}`]))
      );
      setNewCollectionName("");
      setShowCreateCollection(false);
      await reload();
    } catch (error) {
      message.error(
        db.isDuplicateCollectionNameError(error)
          ? t("collection.nameExists")
          : t("collection.createFailed")
      );
    }
  };

  const handleCreateRequest = async (
    collectionId: string,
    parentId: string | null
  ) => {
    try {
      const name = t("request.untitled");
      const itemId = await db.createCollectionItem({
        collection_id: collectionId,
        parent_id: parentId,
        type: "request",
        name,
      });
      setExpandedKeys((keys) =>
        Array.from(
          new Set([
            ...keys,
            `col-${collectionId}`,
            ...(parentId ? [`item-${parentId}`] : []),
          ])
        )
      );
      await reload();
      openTab({
        title: name,
        itemId,
        collectionId,
        workspaceId: activeWorkspace?.id || null,
        request: {
          method: "GET",
          url: "",
          headers: [{ key: "", value: "", enabled: true }],
          queryParams: [{ key: "", value: "", enabled: true }],
          bodyMode: "none",
          bodyContent: "",
          authType: "inherit",
          authConfig: {},
          timeoutMs: 30000,
        },
      });
    } catch {
      message.error(t("collection.itemCreateFailed"));
    }
  };

  const handleCreateFolder = async (
    collectionId: string,
    parentId: string | null
  ) => {
    try {
      const folderId = await db.createCollectionItem({
        collection_id: collectionId,
        parent_id: parentId,
        type: "folder",
        name: t("collection.untitledFolder"),
      });
      setExpandedKeys((keys) =>
        Array.from(
          new Set([
            ...keys,
            `col-${collectionId}`,
            ...(parentId ? [`item-${parentId}`] : []),
            `item-${folderId}`,
          ])
        )
      );
      await reload();
    } catch {
      message.error(t("collection.itemCreateFailed"));
    }
  };

  const startRename = (target: RenameTarget) => {
    setRenaming(target);
    setRenameValue(target.name);
  };

  const cancelRename = () => {
    setRenaming(null);
    setRenameValue("");
  };

  const handleRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) {
      message.warning(t("common.name"));
      return;
    }

    try {
      if (renaming.type === "collection") {
        await db.updateCollection(renaming.id, { name });
      } else {
        await db.updateCollectionItem(renaming.id, { name });
        tabs
          .filter((tab) => tab.itemId === renaming.id)
          .forEach((tab) => updateTab(tab.id, { title: name }));
      }
    } catch (error) {
      message.error(
        db.isDuplicateCollectionNameError(error)
          ? t("collection.nameExists")
          : t("collection.renameFailed")
      );
      return;
    }

    setRenaming(null);
    setRenameValue("");
    await reload();
  };

  const renderInlineRename = () => (
    <span
      className="tree-inline-rename"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <Input
        size="small"
        value={renameValue}
        onChange={(event) => setRenameValue(event.target.value)}
        onPressEnter={() => void handleRename()}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancelRename();
        }}
        autoFocus
        className="tree-inline-rename-input"
      />
      <Button
        type="text"
        size="small"
        icon={<CheckOutlined />}
        title={t("common.save")}
        aria-label={t("common.save")}
        className="tree-inline-rename-action tree-inline-rename-confirm"
        onClick={(event) => {
          event.stopPropagation();
          void handleRename();
        }}
      />
      <Button
        type="text"
        size="small"
        icon={<CloseOutlined />}
        title={t("common.cancel")}
        aria-label={t("common.cancel")}
        className="tree-inline-rename-action"
        onClick={(event) => {
          event.stopPropagation();
          cancelRename();
        }}
      />
    </span>
  );

  const handleDelete = async (
    type: "collection" | "item",
    id: string
  ) => {
    const relatedTabIds = (() => {
      if (type === "collection") {
        return tabs
          .filter((tab) => tab.collectionId === id)
          .map((tab) => tab.id);
      }

      const allItems = Object.values(itemsMap).flat();
      const deletedItemIds = new Set([id]);
      let foundDescendant = true;
      while (foundDescendant) {
        foundDescendant = false;
        for (const item of allItems) {
          if (
            item.parent_id &&
            deletedItemIds.has(item.parent_id) &&
            !deletedItemIds.has(item.id)
          ) {
            deletedItemIds.add(item.id);
            foundDescendant = true;
          }
        }
      }

      return tabs
        .filter((tab) => tab.itemId && deletedItemIds.has(tab.itemId))
        .map((tab) => tab.id);
    })();

    Modal.confirm({
      title:
        relatedTabIds.length > 0
          ? t("collection.deleteWithTabsConfirm", {
              count: relatedTabIds.length,
            })
          : t("collection.deleteConfirm"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          if (type === "collection") {
            await db.deleteCollection(id);
          } else {
            await db.deleteCollectionItem(id);
          }
          closeTabs(relatedTabIds);
          await reload();
        } catch {
          message.error(t("collection.deleteFailed"));
          throw new Error("COLLECTION_DELETE_FAILED");
        }
      },
    });
  };

  async function handleOpenRequest(itemId: string) {
    try {
      const item = await db.getCollectionItem(itemId);
      if (!item || item.type !== "request") return;

      openTab({
        title: item.name,
        itemId: item.id,
        collectionId: item.collection_id,
        workspaceId: activeWorkspace?.id || null,
        request: {
          method: item.method,
          url: item.url,
          headers: parseKeyValueRows(item.headers),
          queryParams: parseKeyValueRows(item.query_params),
          bodyMode: item.body_mode as "none" | "json" | "raw" | "form",
          bodyContent: item.body_content,
          authType: normalizeAuthType(item.auth_type || "inherit"),
          authConfig: parseAuthConfig(item.auth_config),
          timeoutMs: 30000,
        },
      });
    } catch {
      message.error(t("collection.openFailed"));
    }
  }

  const renderNodeAction = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    danger = false
  ) => (
    <Button
      type="text"
      size="small"
      danger={danger}
      icon={icon}
      title={label}
      aria-label={label}
      className="tree-node-action"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );

  // Build tree data
  const buildTree = (
    collectionId: string,
    parentId: string | null
  ): DataNode[] => {
    const items = itemsMap[collectionId] || [];
    return items
      .filter((item) => item.parent_id === parentId)
      .filter(
        (item) =>
          !searchText ||
          item.name.toLowerCase().includes(searchText.toLowerCase())
      )
      .map((item) => ({
        key: `item-${item.id}`,
        title: (
          <Dropdown
            menu={{
              items: [
                item.type === "folder"
                  ? {
                      key: "addRequest",
                      icon: <FileAddOutlined />,
                      label: t("collection.createRequest"),
                      onClick: () =>
                        handleCreateRequest(collectionId, item.id),
                    }
                  : null,
                item.type === "folder"
                  ? {
                      key: "addFolder",
                      icon: <FolderAddOutlined />,
                      label: t("collection.createFolder"),
                      onClick: () =>
                        handleCreateFolder(collectionId, item.id),
                    }
                  : null,
                {
                  key: "rename",
                  icon: <EditOutlined />,
                  label: t("collection.rename"),
                  onClick: () => startRename({ type: "item", id: item.id, name: item.name }),
                },
                { type: "divider" as const },
                {
                  key: "delete",
                  icon: <DeleteOutlined />,
                  label: t("collection.delete"),
                  danger: true,
                  onClick: () => handleDelete("item", item.id),
                },
              ].filter(Boolean) as MenuProps["items"],
            }}
            trigger={["contextMenu"]}
          >
            <span
              className="tree-node-row"
              onClick={(event) => {
                if (item.type === "request" && event.detail === 1) {
                  handleOpenRequest(item.id);
                }
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                startRename({ type: "item", id: item.id, name: item.name });
              }}
            >
              {renaming?.type === "item" && renaming.id === item.id ? (
                renderInlineRename()
              ) : (
                <>
                  <span className="tree-item-label">
                    {item.type === "folder" ? (
                      <FolderOutlined style={{ marginRight: 6 }} />
                    ) : (
                      <span
                        className="tree-method-badge"
                        style={{
                          color: METHOD_COLORS[item.method] || "#999",
                        }}
                      >
                        {item.method}
                      </span>
                    )}
                    <span className="tree-node-name">{item.name}</span>
                  </span>
                  <span className="tree-node-actions">
                    {item.type === "folder" && (
                      <>
                        {renderNodeAction(
                          t("collection.createRequest"),
                          <FileAddOutlined />,
                          () => handleCreateRequest(collectionId, item.id)
                        )}
                        {renderNodeAction(
                          t("collection.createFolder"),
                          <FolderAddOutlined />,
                          () => handleCreateFolder(collectionId, item.id)
                        )}
                      </>
                    )}
                    {renderNodeAction(
                      t("collection.rename"),
                      <EditOutlined />,
                      () =>
                        startRename({
                          type: "item",
                          id: item.id,
                          name: item.name,
                        })
                    )}
                    {renderNodeAction(
                      t("collection.delete"),
                      <DeleteOutlined />,
                      () => handleDelete("item", item.id),
                      true
                    )}
                  </span>
                </>
              )}
            </span>
          </Dropdown>
        ),
        icon: null,
        isLeaf: item.type === "request",
        children:
          item.type === "folder"
            ? buildTree(collectionId, item.id)
            : undefined,
      }));
  };

  const treeData: DataNode[] = collections
    .filter(
      (col) =>
        !searchText ||
        col.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (itemsMap[col.id] || []).some((item) =>
          item.name.toLowerCase().includes(searchText.toLowerCase())
        )
    )
    .map((col) => ({
      key: `col-${col.id}`,
      title: (
        <Dropdown
          menu={{
            items: [
              {
                key: "addRequest",
                icon: <FileAddOutlined />,
                label: t("collection.createRequest"),
                onClick: () => handleCreateRequest(col.id, null),
              },
              {
                key: "addFolder",
                icon: <FolderAddOutlined />,
                label: t("collection.createFolder"),
                onClick: () => handleCreateFolder(col.id, null),
              },
              {
                key: "rename",
                icon: <EditOutlined />,
                label: t("collection.rename"),
                onClick: () =>
                  startRename({
                    type: "collection",
                    id: col.id,
                    name: col.name,
                  }),
              },
              { type: "divider" },
              {
                key: "delete",
                icon: <DeleteOutlined />,
                label: t("collection.delete"),
                danger: true,
                onClick: () => handleDelete("collection", col.id),
              },
            ],
          }}
          trigger={["contextMenu"]}
        >
          <span
            className="tree-node-row tree-collection-row"
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              startRename({
                type: "collection",
                id: col.id,
                name: col.name,
              });
            }}
          >
            {renaming?.type === "collection" && renaming.id === col.id ? (
              renderInlineRename()
            ) : (
              <>
                <span className="tree-collection-label">
                  <FolderOutlined style={{ marginRight: 6 }} />
                  <strong className="tree-node-name">{col.name}</strong>
                </span>
                <span className="tree-node-actions">
                  {renderNodeAction(
                    t("collection.createRequest"),
                    <FileAddOutlined />,
                    () => handleCreateRequest(col.id, null)
                  )}
                  {renderNodeAction(
                    t("collection.createFolder"),
                    <FolderAddOutlined />,
                    () => handleCreateFolder(col.id, null)
                  )}
                  {renderNodeAction(
                    t("collection.rename"),
                    <EditOutlined />,
                    () =>
                      startRename({
                        type: "collection",
                        id: col.id,
                        name: col.name,
                      })
                  )}
                  {renderNodeAction(
                    t("collection.delete"),
                    <DeleteOutlined />,
                    () => handleDelete("collection", col.id),
                    true
                  )}
                </span>
              </>
            )}
          </span>
        </Dropdown>
      ),
      children: buildTree(col.id, null),
    }));

  return (
    <div
      className="collection-tree"
      tabIndex={0}
      aria-label={t("collection.pasteShortcutLabel")}
      onPaste={(event) => {
        if (
          !activeWorkspace ||
          importing ||
          readingImportFile ||
          readingClipboard ||
          isEditablePasteTarget(event.target)
        ) {
          return;
        }
        const content = event.clipboardData.getData("text/plain");
        if (!content.trim()) return;
        event.preventDefault();
        void handleImport(content, true);
      }}
    >
      <div className="collection-tree-header">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          className="collection-tree-create"
          onClick={() => {
            setNewCollectionName(t("collection.untitled"));
            setShowCreateCollection(true);
          }}
          disabled={!activeWorkspace || showCreateCollection}
        >
          {t("collection.create")}
        </Button>
        <span className="collection-tree-header-actions">
          <Tooltip title={t("collection.import")}>
            <Button
              type="text"
              size="small"
              icon={<ImportOutlined />}
              className="collection-tree-header-action"
              aria-label={t("collection.import")}
              loading={importing}
              disabled={
                !activeWorkspace || readingImportFile || readingClipboard
              }
              onClick={() => setShowImportModal(true)}
            />
          </Tooltip>
          <Tooltip title={t("collection.export")}>
            <Button
              type="text"
              size="small"
              icon={<ExportOutlined />}
              className="collection-tree-header-action"
              aria-label={t("collection.export")}
              loading={exporting}
              disabled={!activeWorkspace || collections.length === 0}
              onClick={() => void handleExport()}
            />
          </Tooltip>
        </span>
      </div>

      {showCreateCollection && (
        <div className="tree-inline-rename tree-inline-create-row">
          <FolderOutlined className="tree-inline-create-icon" />
          <Input
            size="small"
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            onPressEnter={() => void handleCreateCollection()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setShowCreateCollection(false);
                setNewCollectionName("");
              }
            }}
            autoFocus
            className="tree-inline-rename-input"
          />
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            title={t("common.save")}
            aria-label={t("common.save")}
            className="tree-inline-rename-action tree-inline-rename-confirm"
            onClick={() => void handleCreateCollection()}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            title={t("common.cancel")}
            aria-label={t("common.cancel")}
            className="tree-inline-rename-action"
            onClick={() => {
              setShowCreateCollection(false);
              setNewCollectionName("");
            }}
          />
        </div>
      )}

      {treeData.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("collection.empty")}
        />
      ) : (
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          blockNode
          className="collection-tree-view"
          showIcon={false}
        />
      )}

      <Modal
        title={t("collection.importTitle")}
        open={showImportModal}
        okText={t("collection.importAndOpen")}
        cancelText={t("common.cancel")}
        confirmLoading={importing || readingImportFile || readingClipboard}
        closable={!importing && !readingImportFile && !readingClipboard}
        maskClosable={!importing && !readingImportFile && !readingClipboard}
        keyboard={!importing && !readingImportFile && !readingClipboard}
        width={720}
        okButtonProps={{
          disabled:
            !activeWorkspace ||
            !importContent.trim() ||
            readingImportFile ||
            readingClipboard,
        }}
        onOk={() => void handleImport()}
        onCancel={closeImportModal}
      >
        <div className="collection-import-modal-content">
          <div className="collection-import-source-row">
            <label
              className="collection-import-format"
              htmlFor="collection-import-source"
            >
              {t("collection.importFormat")}
            </label>
            <span className="collection-import-source-actions">
              <Button
                size="small"
                icon={<SnippetsOutlined />}
                loading={readingClipboard}
                disabled={importing || readingImportFile}
                onClick={() => void handleReadClipboard()}
              >
                {t("collection.importFromClipboard")}
              </Button>
              <Button
                size="small"
                icon={<UploadOutlined />}
                disabled={importing || readingImportFile || readingClipboard}
                onClick={() => importFileInputRef.current?.click()}
              >
                {t("collection.importFromFile")}
              </Button>
            </span>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml,text/x-yaml,text/plain"
              className="collection-import-file-input"
              onChange={(event) => void handleImportFile(event)}
            />
          </div>
          <p className="collection-import-shortcut-hint">
            {t("collection.importShortcutHint")}
          </p>
          <Input.TextArea
            id="collection-import-source"
            value={importContent}
            placeholder={t("collection.importPlaceholder")}
            rows={16}
            readOnly={importing || readingImportFile || readingClipboard}
            spellCheck={false}
            autoFocus
            className="collection-import-textarea"
            onChange={(event) => setImportContent(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void handleImport();
              }
            }}
          />
        </div>
      </Modal>
    </div>
  );
};
