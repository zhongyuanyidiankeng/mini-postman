import React from "react";
import { Tabs, Tag, Space } from "antd";
import { useTranslation } from "react-i18next";
import { useTab } from "../../contexts/TabContext";
import { ResponseBody } from "./ResponseBody";
import { ResponseHeaders } from "./ResponseHeaders";

interface ResponseViewerProps {
  isLightTheme: boolean;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  isLightTheme,
}) => {
  const { t } = useTranslation();
  const { activeTab } = useTab();

  if (!activeTab) return null;
  const res = activeTab.response;

  if (!res) {
    return (
      <div className="response-empty">
        <p style={{ opacity: 0.4 }}>{t("response.noResponse")}</p>
      </div>
    );
  }

  const statusColor =
    res.status >= 200 && res.status < 300
      ? "#49cc90"
      : res.status >= 300 && res.status < 400
        ? "#fca130"
        : "#f93e3e";

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const headerCount = res.headers.length;

  return (
    <div className="response-viewer">
      {res.error && !res.ok ? (
        <div className="response-error">
          <Tag color="red">{t("response.error")}</Tag>
          <span>{res.error}</span>
          {res.durationMs > 0 && (
            <span className="response-meta-item">{res.durationMs} ms</span>
          )}
        </div>
      ) : (
        <>
          <div className="response-status-bar">
            <Space size="middle">
              <span>
                <Tag color={statusColor}>
                  {res.status} {res.statusText}
                </Tag>
              </span>
              <span className="response-meta-item">
                {t("response.time")}: {res.durationMs} ms
              </span>
              <span className="response-meta-item">
                {t("response.size")}: {formatSize(res.bodySize)}
              </span>
              {res.bodyTruncated && (
                <Tag color="orange">{t("response.bodyTruncated")}</Tag>
              )}
            </Space>
          </div>

          <Tabs
            items={[
              {
                key: "body",
                label: t("response.body"),
                children: (
                  <ResponseBody body={res.body} isLightTheme={isLightTheme} />
                ),
              },
              {
                key: "headers",
                label: `${t("response.headers")}${headerCount ? ` (${headerCount})` : ""}`,
                children: <ResponseHeaders headers={res.headers} />,
              },
            ]}
            size="small"
            className="response-tabs"
            defaultActiveKey="body"
          />
        </>
      )}
    </div>
  );
};
