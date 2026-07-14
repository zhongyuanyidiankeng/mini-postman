import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { message } from "antd";
import { useTranslation } from "react-i18next";
import type { Environment } from "../types";
import { useWorkspace } from "./WorkspaceContext";
import * as db from "../services/database";

interface EnvironmentState {
  environments: Environment[];
  activeEnvId: string | null;
  activeEnvVars: Record<string, string>;
  setActiveEnvId: (id: string | null) => void;
  reload: () => Promise<void>;
  reloadActiveVariables: () => Promise<void>;
  createEnvironment: (name: string) => Promise<string>;
  deleteEnvironment: (id: string) => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentState>(null!);

export const useEnvironment = () => useContext(EnvironmentContext);

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [activeEnvVars, setActiveEnvVars] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    if (!activeWorkspace) {
      setEnvironments([]);
      return;
    }
    const list = await db.listEnvironments(activeWorkspace.id);
    setEnvironments(list);
  }, [activeWorkspace]);

  useEffect(() => {
    void reload().catch(() => message.error(t("environment.loadFailed")));
    setActiveEnvId(null);
    setActiveEnvVars({});
  }, [activeWorkspace?.id, reload, t]);

  const reloadActiveVariables = useCallback(async () => {
    if (!activeEnvId) {
      setActiveEnvVars({});
      return;
    }
    const vars = await db.listEnvVariables(activeEnvId);
    const map: Record<string, string> = {};
    for (const v of vars) {
      if (v.enabled) map[v.key] = v.value;
    }
    setActiveEnvVars(map);
  }, [activeEnvId]);

  // Load variables when active env changes
  useEffect(() => {
    void reloadActiveVariables().catch(() => {
      setActiveEnvVars({});
      message.error(t("environment.variablesLoadFailed"));
    });
  }, [reloadActiveVariables, t]);

  const create = async (name: string) => {
    if (!activeWorkspace) throw new Error("NO_ACTIVE_WORKSPACE");
    const id = await db.createEnvironment(activeWorkspace.id, name);
    await reload();
    return id;
  };

  const del = async (id: string) => {
    await db.deleteEnvironment(id);
    if (activeEnvId === id) setActiveEnvId(null);
    await reload();
  };

  return (
    <EnvironmentContext.Provider
      value={{
        environments,
        activeEnvId,
        activeEnvVars,
        setActiveEnvId,
        reload,
        reloadActiveVariables,
        createEnvironment: create,
        deleteEnvironment: del,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};
