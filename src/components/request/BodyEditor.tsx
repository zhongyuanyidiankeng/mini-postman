import React, { useRef } from "react";
import { Radio } from "antd";
import Editor from "@monaco-editor/react";
import { useTranslation } from "react-i18next";
import { KeyValueTable } from "./KeyValueTable";
import type { BodyMode } from "../../types";
import { emptyKeyValue, parseKeyValueRows } from "../../utils/keyValue";

interface BodyEditorProps {
  requestId: string;
  bodyMode: BodyMode;
  bodyContent: string;
  isLightTheme: boolean;
  onModeChange: (
    mode: BodyMode,
    content: string
  ) => void;
  onContentChange: (content: string) => void;
}

const emptyContentForMode = (mode: BodyMode) =>
  mode === "form" ? JSON.stringify([emptyKeyValue()]) : "";

export const BodyEditor: React.FC<BodyEditorProps> = ({
  requestId,
  bodyMode,
  bodyContent,
  isLightTheme,
  onModeChange,
  onContentChange,
}) => {
  const { t } = useTranslation();
  const contentBuffers = useRef<
    Record<string, Partial<Record<BodyMode, string>>>
  >({});
  const requestBuffers = (contentBuffers.current[requestId] ??= {});
  requestBuffers[bodyMode] = bodyContent;

  const formRows = bodyMode === "form" ? parseKeyValueRows(bodyContent) : [];

  const handleModeChange = (mode: BodyMode) => {
    if (mode === bodyMode) return;
    requestBuffers[bodyMode] = bodyContent;
    onModeChange(
      mode,
      requestBuffers[mode] ?? emptyContentForMode(mode)
    );
  };

  return (
    <div className="body-editor">
      <div className="body-mode-selector">
        <Radio.Group
          value={bodyMode}
          onChange={(e) => handleModeChange(e.target.value)}
          size="small"
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="none">
            {t("request.bodyMode.none")}
          </Radio.Button>
          <Radio.Button value="json">
            {t("request.bodyMode.json")}
          </Radio.Button>
          <Radio.Button value="raw">
            {t("request.bodyMode.raw")}
          </Radio.Button>
          <Radio.Button value="form">
            {t("request.bodyMode.form")}
          </Radio.Button>
        </Radio.Group>
      </div>

      <div className="body-content">
        {bodyMode === "none" && (
          <div className="body-empty">
            <p style={{ opacity: 0.5 }}>{t("request.noBody")}</p>
          </div>
        )}

        {bodyMode === "json" && (
          <Editor
            height="200px"
            language="json"
            theme={isLightTheme ? "vs" : "vs-dark"}
            value={bodyContent}
            onChange={(v) => onContentChange(v || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
            }}
          />
        )}

        {bodyMode === "raw" && (
          <Editor
            height="200px"
            language="plaintext"
            theme={isLightTheme ? "vs" : "vs-dark"}
            value={bodyContent}
            onChange={(v) => onContentChange(v || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "off",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
            }}
          />
        )}

        {bodyMode === "form" && (
          <KeyValueTable
            rows={formRows}
            onChange={(rows) => onContentChange(JSON.stringify(rows))}
          />
        )}
      </div>
    </div>
  );
};
