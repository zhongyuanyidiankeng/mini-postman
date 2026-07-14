import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { useTranslation } from "react-i18next";
import type { Workspace } from "../types";
import * as db from "../services/database";

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceState>(null!);

export const useWorkspace = () => useContext(WorkspaceContext);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  const reload = useCallback(async () => {
    const list = await db.listWorkspaces();
    setWorkspaces(list);
    if (!activeWorkspace && list.length > 0) {
      setActiveWorkspace(list[0]);
    } else if (activeWorkspace) {
      const still = list.find((w) => w.id === activeWorkspace.id);
      if (!still && list.length > 0) setActiveWorkspace(list[0]);
      else if (!still) setActiveWorkspace(null);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    void reload().catch(() => message.error(t("workspace.loadFailed")));
  }, [reload, t]);

  const create = async (name: string) => {
    await db.createWorkspace(name);
    await reload();
  };

  const rename = async (id: string, name: string) => {
    await db.updateWorkspace(id, name);
    await reload();
  };

  const del = async (id: string) => {
    if (workspaces.length <= 1) return;
    await db.deleteWorkspace(id);
    await reload();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        createWorkspace: create,
        renameWorkspace: rename,
        deleteWorkspace: del,
        reload,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
