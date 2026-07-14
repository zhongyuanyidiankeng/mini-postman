import React, { createContext, useContext, useState, useCallback } from "react";
import type { TabItem, HttpRequest } from "../types";

function newRequest(): HttpRequest {
  return {
    method: "GET",
    url: "",
    headers: [{ key: "", value: "", enabled: true }],
    queryParams: [{ key: "", value: "", enabled: true }],
    bodyMode: "none",
    bodyContent: "",
    authType: "inherit",
    authConfig: {},
    timeoutMs: 30000,
  };
}

interface TabState {
  tabs: TabItem[];
  activeTabId: string | null;
  activeTab: TabItem | null;
  openTab: (tab?: Partial<TabItem>) => string;
  closeTab: (id: string) => void;
  closeTabs: (ids: string[]) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTabId: (id: string) => void;
  updateTab: (id: string, updates: Partial<TabItem>) => void;
  markDirty: (id: string) => void;
  markClean: (id: string) => void;
}

const TabContext = createContext<TabState>(null!);

export const useTab = () => useContext(TabContext);

export const TabProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  const openTab = useCallback(
    (partial?: Partial<TabItem>): string => {
      // If itemId is provided and a tab already exists for it, activate it
      if (partial?.itemId) {
        const existing = tabs.find((t) => t.itemId === partial.itemId);
        if (existing) {
          setActiveTabId(existing.id);
          return existing.id;
        }
      }

      const id = crypto.randomUUID();
      const tab: TabItem = {
        id,
        title: partial?.title || "Untitled Request",
        itemId: partial?.itemId || null,
        isDirty: false,
        source: partial?.source || "request",
        request: partial?.request || newRequest(),
        response: partial?.response || null,
        collectionId: partial?.collectionId || null,
        workspaceId: partial?.workspaceId || null,
        ...partial,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(id);
      return id;
    },
    [tabs]
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          if (next.length === 0) {
            setActiveTabId(null);
          } else {
            const newIdx = Math.min(idx, next.length - 1);
            setActiveTabId(next[newIdx].id);
          }
        }
        return next;
      });
    },
    [activeTabId]
  );

  const closeTabs = useCallback(
    (ids: string[]) => {
      const closingIds = new Set(ids);
      if (closingIds.size === 0) return;

      setTabs((prev) => {
        const activeIndex = prev.findIndex((tab) => tab.id === activeTabId);
        const next = prev.filter((tab) => !closingIds.has(tab.id));
        if (activeTabId && closingIds.has(activeTabId)) {
          const nextIndex = Math.min(Math.max(activeIndex, 0), next.length - 1);
          setActiveTabId(next[nextIndex]?.id || null);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const closeOtherTabs = useCallback((id: string) => {
    setTabs((prev) => prev.filter((tab) => tab.id === id));
    setActiveTabId(id);
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<TabItem>) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const markDirty = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDirty: true } : t))
    );
  }, []);

  const markClean = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDirty: false } : t))
    );
  }, []);

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTabId,
        activeTab,
        openTab,
        closeTab,
        closeTabs,
        closeOtherTabs,
        closeAllTabs,
        setActiveTabId,
        updateTab,
        markDirty,
        markClean,
      }}
    >
      {children}
    </TabContext.Provider>
  );
};
