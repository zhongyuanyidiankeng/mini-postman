import React, { useState } from "react";
import { Button, Input, Modal, Select, message } from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useTab } from "../../contexts/TabContext";
import type { Workspace } from "../../types";
import { DEFAULT_WORKSPACE_ID } from "../../services/database";

export const WorkspaceSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    createWorkspace,
    deleteWorkspace,
  } = useWorkspace();
  const { tabs, closeTabs } = useTab();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const workspaceLabel = (workspace: Workspace) =>
    workspace.id === DEFAULT_WORKSPACE_ID
      ? t("workspace.defaultName")
      : workspace.name;
  const activeWorkspaceLabel = activeWorkspace
    ? workspaceLabel(activeWorkspace)
    : "";

  const relatedTabIds = activeWorkspace
    ? tabs
        .filter((tab) => tab.workspaceId === activeWorkspace.id)
        .map((tab) => tab.id)
    : [];

  const cancelCreate = () => {
    setCreating(false);
    setNewName("");
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createWorkspace(name);
      cancelCreate();
      setDropdownOpen(false);
    } catch {
      message.error(t("workspace.createFailed"));
    }
  };

  const openDeleteConfirm = () => {
    if (!activeWorkspace || workspaces.length <= 1) return;
    setDeleteConfirmName("");
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (
      !activeWorkspace ||
      workspaces.length <= 1 ||
      deleteConfirmName !== activeWorkspaceLabel
    ) {
      return;
    }

    setDeleting(true);
    try {
      await deleteWorkspace(activeWorkspace.id);
      closeTabs(relatedTabIds);
      setDeleteOpen(false);
      setDeleteConfirmName("");
    } catch {
      message.error(t("workspace.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="workspace-switcher">
      <Select
        value={activeWorkspace?.id}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        onChange={(id) => {
          const workspace = workspaces.find((item) => item.id === id);
          if (workspace) setActiveWorkspace(workspace);
        }}
        options={workspaces.map((workspace) => ({
          value: workspace.id,
          label: workspaceLabel(workspace),
        }))}
        size="small"
        style={{ flex: 1 }}
        popupMatchSelectWidth={false}
        dropdownRender={(menu) => (
          <>
            {menu}
            <div
              className="workspace-dropdown-footer"
              onMouseDown={(event) => event.stopPropagation()}
            >
              {creating ? (
                <div className="workspace-inline-create">
                  <Input
                    size="small"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onPressEnter={() => void handleCreate()}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelCreate();
                    }}
                    autoFocus
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => void handleCreate()}
                    title={t("common.save")}
                    aria-label={t("common.save")}
                    className="workspace-inline-action workspace-inline-confirm"
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={cancelCreate}
                    title={t("common.cancel")}
                    aria-label={t("common.cancel")}
                    className="workspace-inline-action"
                  />
                </div>
              ) : (
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setNewName(t("workspace.untitled"));
                    setCreating(true);
                  }}
                  block
                >
                  {t("workspace.create")}
                </Button>
              )}
            </div>
          </>
        )}
      />

      <Button
        type="text"
        size="small"
        danger
        icon={<DeleteOutlined />}
        disabled={!activeWorkspace || workspaces.length <= 1}
        onClick={openDeleteConfirm}
        title={
          workspaces.length <= 1
            ? t("workspace.keepOne")
            : t("workspace.delete")
        }
        aria-label={t("workspace.delete")}
        className="workspace-delete-button"
      />

      <Modal
        title={t("workspace.delete")}
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={handleDelete}
        okText={t("common.delete")}
        cancelText={t("common.cancel")}
        confirmLoading={deleting}
        okButtonProps={{
          danger: true,
          disabled: deleteConfirmName !== activeWorkspaceLabel,
        }}
        width={460}
      >
        <div className="workspace-delete-confirm">
          <p>{t("workspace.deleteConfirm")}</p>
          {relatedTabIds.length > 0 && (
            <p className="workspace-delete-tabs-warning">
              {t("workspace.deleteTabsConfirm", {
                count: relatedTabIds.length,
              })}
            </p>
          )}
          <label className="save-request-field">
            <span>
              {t("workspace.typeNameToConfirm", {
                name: activeWorkspaceLabel,
              })}
            </span>
            <Input
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              onPressEnter={() => void handleDelete()}
              autoFocus
            />
          </label>
        </div>
      </Modal>
    </div>
  );
};
