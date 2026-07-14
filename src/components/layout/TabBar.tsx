import React, { useRef, useState } from "react";
import { Dropdown, Input, Tabs, message } from "antd";
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useTab } from "../../contexts/TabContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useTranslation } from "react-i18next";
import { METHOD_COLORS } from "../../constants/http";
import * as db from "../../services/database";

export const TabBar: React.FC = () => {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    updateTab,
  } = useTab();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const cancelRenameRef = useRef(false);

  const startRename = (tabId: string, title: string) => {
    cancelRenameRef.current = false;
    setEditingTabId(tabId);
    setRenameValue(title);
  };

  const commitRename = async () => {
    const tabId = editingTabId;
    setEditingTabId(null);
    if (!tabId) return;

    const name = renameValue.trim();
    const tab = tabs.find((item) => item.id === tabId);
    if (!name || !tab || name === tab.title) return;

    try {
      if (tab.itemId) {
        await db.updateCollectionItem(tab.itemId, { name });
      }
      updateTab(tabId, { title: name });
      window.dispatchEvent(new Event("mini-postman:collection-updated"));
    } catch {
      message.error(t("tab.renameFailed"));
    }
  };

  const items = tabs.map((tab) => ({
    key: tab.id,
    label: (
      <Dropdown
        trigger={["contextMenu"]}
        menu={{
          items: [
            {
              key: "rename",
              icon: <EditOutlined />,
              label: t("tab.rename"),
              onClick: () => startRename(tab.id, tab.title),
            },
            { type: "divider" },
            {
              key: "close",
              icon: <CloseOutlined />,
              label: t("tab.close"),
              onClick: () => closeTab(tab.id),
            },
            {
              key: "closeOthers",
              icon: <MinusCircleOutlined />,
              label: t("tab.closeOthers"),
              disabled: tabs.length <= 1,
              onClick: () => closeOtherTabs(tab.id),
            },
            {
              key: "closeAll",
              icon: <DeleteOutlined />,
              label: t("tab.closeAll"),
              onClick: closeAllTabs,
            },
          ],
        }}
      >
        <span
          className={`tab-label ${
            tab.source === "history" ? "tab-label-history" : ""
          }`}
          onContextMenu={() => setActiveTabId(tab.id)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            startRename(tab.id, tab.title);
          }}
        >
          {tab.id === activeTabId && (
            <span className="tab-active-indicator" aria-hidden="true" />
          )}
          {tab.source === "history" && (
            <HistoryOutlined
              className="tab-source-icon"
              title={t("history.snapshot")}
            />
          )}
          <span
            className="tab-method"
            style={{
              color: METHOD_COLORS[tab.request.method] || "#999",
            }}
          >
            {tab.request.method}
          </span>
          {editingTabId === tab.id ? (
            <Input
              className="tab-title-input"
              size="small"
              variant="borderless"
              value={renameValue}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={() => {
                if (cancelRenameRef.current) {
                  cancelRenameRef.current = false;
                  setEditingTabId(null);
                  return;
                }
                void commitRename();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  cancelRenameRef.current = true;
                  event.currentTarget.blur();
                }
              }}
            />
          ) : (
            <span className="tab-title">{tab.title}</span>
          )}
          {tab.isDirty && <span className="tab-dirty-dot" />}
        </span>
      </Dropdown>
    ),
    closable: true,
  }));

  return (
    <div className="tab-bar">
      <Tabs
        type="editable-card"
        activeKey={activeTabId || undefined}
        onChange={setActiveTabId}
        onEdit={(key, action) => {
          if (action === "add") {
            openTab({
              title: t("request.untitled"),
              workspaceId: activeWorkspace?.id || null,
            });
          } else if (action === "remove" && typeof key === "string") {
            closeTab(key);
          }
        }}
        items={items}
        size="small"
        className="tab-bar-tabs"
        addIcon={<PlusOutlined />}
      />
    </div>
  );
};
