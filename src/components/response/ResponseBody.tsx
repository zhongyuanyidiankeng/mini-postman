import React, { useState, useMemo } from "react";
import { Radio, Button, message } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import Editor from "@monaco-editor/react";
import { useTranslation } from "react-i18next";

interface ResponseBodyProps {
  body: string;
  isLightTheme: boolean;
}

export const ResponseBody: React.FC<ResponseBodyProps> = ({
  body,
  isLightTheme,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"pretty" | "raw">("pretty");

  const prettyBody = useMemo(() => {
    if (viewMode !== "pretty") return body;
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }, [body, viewMode]);

  const isJson = useMemo(() => {
    try {
      JSON.parse(body);
      return true;
    } catch {
      return false;
    }
  }, [body]);

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    message.success(t("response.copySuccess"));
  };

  return (
    <div className="response-body">
      <div className="response-body-toolbar">
        <Radio.Group
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          size="small"
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="pretty">{t("response.pretty")}</Radio.Button>
          <Radio.Button value="raw">{t("response.raw")}</Radio.Button>
        </Radio.Group>

        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={handleCopy}
          type="text"
        >
          {t("response.copy")}
        </Button>
      </div>

      <div className="response-body-content">
        <Editor
          height="100%"
          language={isJson ? "json" : "plaintext"}
          theme={isLightTheme ? "vs" : "vs-dark"}
          value={prettyBody}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: viewMode === "pretty" ? "on" : "off",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
            folding: true,
          }}
        />
      </div>
    </div>
  );
};
