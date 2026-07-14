import React from "react";
import { Select, Input, Button, Space, Tooltip } from "antd";
import {
  SendOutlined,
  SaveOutlined,
  CodeOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { HTTP_METHODS, METHOD_COLORS } from "../../constants/http";


interface MethodUrlBarProps {
  method: string;
  url: string;
  sending: boolean;
  onMethodChange: (method: string) => void;
  onUrlChange: (url: string) => void;
  onSend: () => void;
  onSave: () => void;
  onCurl: () => void;
}

export const MethodUrlBar: React.FC<MethodUrlBarProps> = ({
  method,
  url,
  sending,
  onMethodChange,
  onUrlChange,
  onSend,
  onSave,
  onCurl,
}) => {
  const { t } = useTranslation();

  return (
    <div className="method-url-bar">
      <Select
        value={method}
        onChange={onMethodChange}
        options={HTTP_METHODS.map((m) => ({
          value: m,
          label: (
            <span style={{ color: METHOD_COLORS[m], fontWeight: 600 }}>
              {m}
            </span>
          ),
        }))}
        className="method-select"
        popupMatchSelectWidth={false}
      />

      <Input
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder={t("request.url")}
        className="url-input"
        onPressEnter={() => {
          if (sending) return;
          onSend();
        }}
      />

      <Space.Compact>
        <Button
          type="primary"
          icon={sending ? <LoadingOutlined /> : <SendOutlined />}
          onClick={onSend}
          disabled={sending}
          className="send-btn"
        >
          {t("request.send")}
        </Button>

        <Tooltip title={t("request.save")}>
          <Button icon={<SaveOutlined />} onClick={onSave} />
        </Tooltip>

        <Tooltip title={t("common.generateCurl")}>
          <Button icon={<CodeOutlined />} onClick={onCurl} />
        </Tooltip>
      </Space.Compact>
    </div>
  );
};
