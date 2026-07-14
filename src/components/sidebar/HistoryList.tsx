import React, { useCallback, useEffect, useState } from "react";
import { List, Empty, Button, Modal, Tag, message } from "antd";
import {
  ClockCircleOutlined,
  DeleteOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useTab } from "../../contexts/TabContext";
import type {
  HttpRequest,
  HttpResponse,
  RequestHistoryItem,
} from "../../types";
import { normalizeAuthType, parseAuthConfig } from "../../services/auth";
import * as db from "../../services/database";
import { METHOD_COLORS } from "../../constants/http";
import { normalizeKeyValueRows } from "../../utils/keyValue";

function historyRequest(item: RequestHistoryItem): HttpRequest {
  let stored: Partial<HttpRequest> = {};
  try {
    const parsed: unknown = JSON.parse(item.request_data);
    if (parsed && typeof parsed === "object") {
      stored = parsed as Partial<HttpRequest>;
    }
  } catch {
    // Fall through to the history row's stable columns.
  }

  const bodyMode = ["none", "json", "raw", "form"].includes(
    stored.bodyMode || ""
  )
    ? stored.bodyMode!
    : "none";

  return {
    method: stored.method || item.method,
    url: stored.url || item.url,
    headers: normalizeKeyValueRows(stored.headers),
    queryParams: normalizeKeyValueRows(stored.queryParams),
    bodyMode,
    bodyContent:
      typeof stored.bodyContent === "string" ? stored.bodyContent : "",
    authType: normalizeAuthType(stored.authType || "inherit"),
    authConfig: parseAuthConfig(stored.authConfig),
    timeoutMs:
      typeof stored.timeoutMs === "number" ? stored.timeoutMs : 30000,
  };
}

function historyResponse(item: RequestHistoryItem): HttpResponse | null {
  if (!item.response_data) return null;
  try {
    const parsed: unknown = JSON.parse(item.response_data);
    if (!parsed || typeof parsed !== "object") return null;
    const response = parsed as Partial<HttpResponse>;
    return {
      ok: Boolean(response.ok),
      status: typeof response.status === "number" ? response.status : 0,
      statusText:
        typeof response.statusText === "string" ? response.statusText : "",
      durationMs:
        typeof response.durationMs === "number"
          ? response.durationMs
          : item.duration_ms || 0,
      headers: Array.isArray(response.headers) ? response.headers : [],
      body: typeof response.body === "string" ? response.body : "",
      bodySize:
        typeof response.bodySize === "number" ? response.bodySize : 0,
      bodyTruncated: Boolean(response.bodyTruncated),
      error: typeof response.error === "string" ? response.error : null,
    };
  } catch {
    return null;
  }
}

function requestPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function formatHistoryTime(value: string, language: string): string {
  const isoValue = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language.startsWith("zh") ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const HistoryList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const { openTab } = useTab();
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);

  const reload = useCallback(async () => {
    if (!activeWorkspace) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await db.listHistory(activeWorkspace.id, 200));
    } catch {
      setHistory([]);
      message.error(t("history.loadFailed"));
    }
  }, [activeWorkspace, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handleHistoryUpdate = () => void reload();
    window.addEventListener(
      "mini-postman:history-updated",
      handleHistoryUpdate
    );
    return () =>
      window.removeEventListener(
        "mini-postman:history-updated",
        handleHistoryUpdate
      );
  }, [reload]);

  const handleReplay = (item: RequestHistoryItem) => {
    openTab({
      title: requestPath(item.url),
      itemId: null,
      collectionId: item.collection_id,
      workspaceId: activeWorkspace?.id || null,
      source: "history",
      request: historyRequest(item),
      response: historyResponse(item),
    });
  };

  const handleClear = () => {
    Modal.confirm({
      title: t("history.clearConfirm"),
      onOk: async () => {
        if (!activeWorkspace) return;
        try {
          await db.clearHistory(activeWorkspace.id);
          setHistory([]);
        } catch {
          message.error(t("history.clearFailed"));
          throw new Error("HISTORY_CLEAR_FAILED");
        }
      },
    });
  };

  if (history.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("history.empty")}
      />
    );
  }

  return (
    <div className="history-list">
      <div className="history-header">
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          danger
          onClick={handleClear}
        >
          {t("history.clear")}
        </Button>
      </div>
      <List
        size="small"
        dataSource={history}
        renderItem={(item) => {
          const pathname = requestPath(item.url);
          const hasResponse = Boolean(item.response_data);
          return (
            <List.Item
              className={`history-item ${
                item.status !== null && item.status > 0 && item.status < 400
                  ? "history-item-success"
                  : "history-item-error"
              }`}
              onClick={() => handleReplay(item)}
              title={item.url}
            >
              <span className="history-timeline-icon">
                <HistoryOutlined />
              </span>
              <div className="history-item-details">
                <div className="history-item-content">
                  <Tag
                    color={METHOD_COLORS[item.method]}
                    className="history-method"
                  >
                    {item.method}
                  </Tag>
                  <span className="history-url">{pathname}</span>
                  {item.status !== null && (
                    <span
                      className="history-status"
                      style={{
                        color:
                          item.status > 0 && item.status < 400
                            ? "#49cc90"
                            : "#f93e3e",
                      }}
                    >
                      {item.status === 0 ? t("history.failed") : item.status}
                    </span>
                  )}
                </div>
                <div className="history-meta">
                  <span>
                    <ClockCircleOutlined />{" "}
                    {formatHistoryTime(
                      item.created_at,
                      i18n.resolvedLanguage || i18n.language
                    )}
                  </span>
                  {item.duration_ms !== null && (
                    <span>{item.duration_ms} ms</span>
                  )}
                  {hasResponse && (
                    <span title={t("history.responseSaved")}>
                      {t("history.snapshot")}
                    </span>
                  )}
                </div>
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
};
