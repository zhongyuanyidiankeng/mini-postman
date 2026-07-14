import React, { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, message } from "antd";
import { useTranslation } from "react-i18next";
import { useTab } from "../../contexts/TabContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useEnvironment } from "../../contexts/EnvironmentContext";
import { MethodUrlBar } from "./MethodUrlBar";
import { KeyValueTable } from "./KeyValueTable";
import { BodyEditor } from "./BodyEditor";
import { AuthEditor } from "./AuthEditor";
import { SaveRequestModal } from "./SaveRequestModal";
import { sendRequest, generateCurl } from "../../services/httpClient";
import {
  resolveRequestVariables,
  resolveVariables,
} from "../../services/variableResolver";
import {
  applyRequestAuth,
  normalizeAuthType,
  parseAuthConfig,
} from "../../services/auth";
import * as db from "../../services/database";
import type {
  HttpRequest,
  HttpResponse,
  KeyValue,
  RequestAuthConfig,
} from "../../types";

interface RequestBuilderProps {
  isLightTheme: boolean;
}

const MAX_HISTORY_RESPONSE_BODY_BYTES = 512 * 1024;

function variableMap(
  rows: Array<{ key: string; value: string; enabled: number }>
): Record<string, string> {
  return Object.fromEntries(
    rows
      .filter((row) => Boolean(row.enabled) && row.key.trim())
      .map((row) => [row.key, row.value])
  );
}

function historyResponseSnapshot(response: HttpResponse): HttpResponse {
  const bodyBytes = new TextEncoder().encode(response.body);
  if (bodyBytes.byteLength <= MAX_HISTORY_RESPONSE_BODY_BYTES) return response;

  let end = MAX_HISTORY_RESPONSE_BODY_BYTES;
  let body = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  while (end > 0) {
    try {
      body = decoder.decode(bodyBytes.slice(0, end));
      break;
    } catch {
      end -= 1;
    }
  }

  return {
    ...response,
    body,
    bodyTruncated: true,
  };
}

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  isLightTheme,
}) => {
  const { t } = useTranslation();
  const { activeTab, updateTab, markDirty } = useTab();
  const { activeWorkspace } = useWorkspace();
  const { activeEnvVars } = useEnvironment();
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    if (!activeTab.itemId) {
      if (!activeWorkspace) {
        message.error(t("request.workspaceMissing"));
        return;
      }
      setSaveAsOpen(true);
      return;
    }

    const request = activeTab.request;
    try {
      const [collection, item] = await Promise.all([
        activeTab.collectionId
          ? db.getCollection(activeTab.collectionId)
          : Promise.resolve(null),
        db.getCollectionItem(activeTab.itemId),
      ]);
      if (
        !activeWorkspace ||
        !collection ||
        collection.workspace_id !== activeWorkspace.id ||
        !item ||
        item.collection_id !== collection.id
      ) {
        message.error(t("request.parentCollectionMissing"));
        return;
      }

      await db.updateCollectionItem(activeTab.itemId, {
        method: request.method,
        url: request.url,
        headers: JSON.stringify(request.headers),
        query_params: JSON.stringify(request.queryParams),
        body_mode: request.bodyMode,
        body_content: request.bodyContent,
        auth_type: request.authType,
        auth_config: JSON.stringify(request.authConfig),
      });
      updateTab(activeTab.id, { isDirty: false });
      window.dispatchEvent(
        new CustomEvent("mini-postman:collection-updated", {
          detail: { collectionId: collection.id },
        })
      );
      message.success(t("common.save"));
    } catch {
      message.error(t("request.saveFailed"));
    }
  }, [activeTab, activeWorkspace, t, updateTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        activeTab &&
        !event.repeat &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeTab, handleSave]);

  useEffect(() => {
    setSaveAsOpen(false);
  }, [activeTab?.id]);

  if (!activeTab) return null;
  const req = activeTab.request;

  const update = (partial: Partial<HttpRequest>) => {
    updateTab(activeTab.id, {
      request: { ...req, ...partial },
    });
    markDirty(activeTab.id);
  };

  const prepareRequest = async (): Promise<HttpRequest> => {
    const [collectionVariableRows, globalVariableRows] = await Promise.all([
      activeTab.collectionId
        ? db.listCollectionVariables(activeTab.collectionId)
        : Promise.resolve([]),
      activeWorkspace
        ? db.listGlobalVariables(activeWorkspace.id)
        : Promise.resolve([]),
    ]);
    const collectionVars = variableMap(collectionVariableRows);
    const globalVars = variableMap(globalVariableRows);
    let effectiveAuthType = normalizeAuthType(req.authType);
    let effectiveAuthConfig = parseAuthConfig(req.authConfig);

    if (effectiveAuthType === "inherit") {
      const collection = activeTab.collectionId
        ? await db.getCollection(activeTab.collectionId)
        : null;
      effectiveAuthType = normalizeAuthType(collection?.auth_type);
      effectiveAuthConfig = parseAuthConfig(collection?.auth_config);
    }

    const resolveAuthValue = (value: string | undefined) =>
      value
        ? resolveVariables(value, activeEnvVars, collectionVars, globalVars)
        : value;
    const resolvedAuthConfig: RequestAuthConfig = {
      ...effectiveAuthConfig,
      username: resolveAuthValue(effectiveAuthConfig.username),
      password: resolveAuthValue(effectiveAuthConfig.password),
      token: resolveAuthValue(effectiveAuthConfig.token),
      key: resolveAuthValue(effectiveAuthConfig.key),
      value: resolveAuthValue(effectiveAuthConfig.value),
    };

    const authenticated = applyRequestAuth(
      req,
      effectiveAuthType,
      resolvedAuthConfig
    );
    const resolved = resolveRequestVariables(
      authenticated.url,
      authenticated.headers,
      authenticated.queryParams,
      authenticated.bodyContent,
      activeEnvVars,
      collectionVars,
      globalVars
    );

    return { ...authenticated, ...resolved };
  };

  const errorResponse = (error: unknown): HttpResponse => ({
    ok: false,
    status: 0,
    statusText: "",
    durationMs: 0,
    headers: [],
    body: "",
    bodySize: 0,
    bodyTruncated: false,
    error: String(error),
  });

  const handleSend = async () => {
    if (sending || sendingRef.current) return;
    if (!req.url.trim()) {
      message.warning(t("request.url"));
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      let response: HttpResponse;
      try {
        response = await sendRequest(await prepareRequest());
      } catch (error) {
        response = errorResponse(error);
      }

      updateTab(activeTab.id, { response });

      if (activeWorkspace) {
        try {
          await db.addHistory({
            id: crypto.randomUUID(),
            workspace_id: activeWorkspace.id,
            collection_id: activeTab.collectionId,
            item_id: activeTab.itemId,
            method: req.method,
            url: req.url,
            request_data: JSON.stringify(req),
            response_data: JSON.stringify(historyResponseSnapshot(response)),
            status: response.status,
            duration_ms: response.durationMs,
          });
          window.dispatchEvent(new Event("mini-postman:history-updated"));
        } catch {
          message.warning(t("history.saveFailed"));
        }
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleCurl = async () => {
    try {
      const curl = await generateCurl(await prepareRequest());
      await navigator.clipboard.writeText(curl);
      message.success(t("common.curlCopied"));
    } catch (e) {
      message.error(String(e));
    }
  };

  const activeHeaders = req.headers.filter(
    (h) => h.enabled && h.key.trim()
  ).length;
  const activeParams = req.queryParams.filter(
    (p) => p.enabled && p.key.trim()
  ).length;

  const tabItems = [
    {
      key: "params",
      label: `${t("request.params")}${activeParams ? ` (${activeParams})` : ""}`,
      children: (
        <KeyValueTable
          rows={req.queryParams}
          onChange={(rows) => update({ queryParams: rows })}
        />
      ),
    },
    {
      key: "headers",
      label: `${t("request.headers")}${activeHeaders ? ` (${activeHeaders})` : ""}`,
      children: (
        <KeyValueTable
          rows={req.headers}
          onChange={(rows) => update({ headers: rows })}
        />
      ),
    },
    {
      key: "body",
      label: t("request.body"),
      children: (
        <BodyEditor
          requestId={activeTab.id}
          bodyMode={req.bodyMode}
          bodyContent={req.bodyContent}
          isLightTheme={isLightTheme}
          onModeChange={(mode, bodyContent) =>
            update({ bodyMode: mode, bodyContent })
          }
          onContentChange={(content) => update({ bodyContent: content })}
        />
      ),
    },
    {
      key: "auth",
      label: t("request.auth"),
      children: (
        <AuthEditor
          authType={normalizeAuthType(req.authType)}
          authConfig={parseAuthConfig(req.authConfig)}
          collectionId={activeTab.collectionId}
          onChange={(authType, authConfig) => update({ authType, authConfig })}
        />
      ),
    },
  ];

  return (
    <div className="request-builder">
      <MethodUrlBar
        method={req.method}
        url={req.url}
        sending={sending}
        onMethodChange={(method) => update({ method })}
        onUrlChange={(url) => update({ url })}
        onSend={handleSend}
        onSave={handleSave}
        onCurl={handleCurl}
      />
      <Tabs
        items={tabItems}
        size="small"
        className="request-tabs"
        defaultActiveKey="params"
      />
      <SaveRequestModal
        open={saveAsOpen}
        tabId={activeTab.id}
        request={req}
        suggestedName={activeTab.title}
        workspaceId={activeWorkspace?.id || null}
        preferredCollectionId={activeTab.collectionId}
        onCancel={() => setSaveAsOpen(false)}
        onSaved={(tabId, itemId, collectionId, name) => {
          updateTab(tabId, {
            itemId,
            collectionId,
            workspaceId: activeWorkspace?.id || null,
            title: name,
            isDirty: false,
            source: "request",
          });
          setSaveAsOpen(false);
          window.dispatchEvent(
            new CustomEvent("mini-postman:collection-updated", {
              detail: { collectionId },
            })
          );
          message.success(t("common.save"));
        }}
      />
    </div>
  );
};
