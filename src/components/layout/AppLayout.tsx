import React, { useState } from "react";
import { Button, Dropdown, Layout } from "antd";
import {
  BgColorsOutlined,
  CheckOutlined,
  MenuUnfoldOutlined,
  TranslationOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { RequestBuilder } from "../request/RequestBuilder";
import { ResponseViewer } from "../response/ResponseViewer";
import { useTab } from "../../contexts/TabContext";
import {
  BACKGROUND_THEMES,
  isBackgroundTheme,
  useAppTheme,
} from "../../contexts/ThemeContext";

const { Sider, Content } = Layout;

export const AppLayout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { activeTab } = useTab();
  const { backgroundTheme, setBackgroundTheme, activeBackground } =
    useAppTheme();
  const siderWidth = 280;
  const [collapsed, setCollapsed] = useState(false);
  const activeLanguage = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";

  return (
    <Layout className="app-root">
      <Sider
        width={siderWidth}
        collapsedWidth={0}
        collapsed={collapsed}
        className="app-sider"
        theme={activeBackground.isLight ? "light" : "dark"}
        collapsible
        trigger={null}
      >
        <Sidebar onToggle={() => setCollapsed((c) => !c)} />
      </Sider>

      <Layout className="app-main">
        {collapsed && (
          <Button
            type="text"
            size="small"
            icon={<MenuUnfoldOutlined />}
            onClick={() => setCollapsed(false)}
            className="sidebar-expand-button"
            aria-label={t("common.expandSidebar")}
            title={t("common.expandSidebar")}
          />
        )}

        <div className="app-topbar">
          <TabBar />
          <div className="app-topbar-actions">
            <Dropdown
              trigger={["click"]}
              menu={{
                selectedKeys: [activeLanguage],
                onClick: ({ key }) => {
                  if (key === "zh" || key === "en") {
                    void i18n.changeLanguage(key);
                  }
                },
                items: [
                  { key: "zh", label: "中文" },
                  { key: "en", label: "English" },
                ].map((item) => ({
                  key: item.key,
                  label: (
                    <span className="language-option">
                      <span>{item.label}</span>
                      <span className="background-theme-check">
                        {item.key === activeLanguage && <CheckOutlined />}
                      </span>
                    </span>
                  ),
                })),
              }}
            >
              <Button
                type="text"
                size="small"
                icon={<TranslationOutlined />}
                className="background-theme-button"
                aria-label={t("app.language")}
                title={t("app.language")}
              />
            </Dropdown>
            <Dropdown
              trigger={["click"]}
              menu={{
                selectedKeys: [backgroundTheme],
                onClick: ({ key }) => {
                  if (isBackgroundTheme(key)) {
                    setBackgroundTheme(key);
                  }
                },
                items: BACKGROUND_THEMES.map((item) => ({
                  key: item.key,
                  label: (
                    <span className="background-theme-option">
                      <span
                        className="background-theme-swatch"
                        style={{ background: item.color }}
                      />
                      <span className="background-theme-label">
                        {t(item.labelKey)}
                      </span>
                      <span className="background-theme-check">
                        {item.key === backgroundTheme && <CheckOutlined />}
                      </span>
                    </span>
                  ),
                })),
              }}
            >
              <Button
                type="text"
                size="small"
                icon={<BgColorsOutlined />}
                className="background-theme-button"
                aria-label={t("theme.background")}
                title={`${t("theme.background")}: ${t(
                  activeBackground.labelKey
                )}`}
              />
            </Dropdown>
          </div>
        </div>

        <Content className="app-content">
          {activeTab ? (
            <div className="request-response-split">
              <div className="request-pane">
                <RequestBuilder isLightTheme={activeBackground.isLight} />
              </div>
              <div className="response-pane">
                <ResponseViewer isLightTheme={activeBackground.isLight} />
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-inner">
                <h2>Mini Postman</h2>
                <p style={{ opacity: 0.6 }}>
                  {t("app.emptyHint")}
                </p>
              </div>
            </div>
          )}
        </Content>
      </Layout>
      </Layout>
  );
};
