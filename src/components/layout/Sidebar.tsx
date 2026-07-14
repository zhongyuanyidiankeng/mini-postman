import React, { useState } from "react";
import { Button, Input, Tabs } from "antd";
import {
  SearchOutlined,
  HistoryOutlined,
  ApiOutlined,
  MenuFoldOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { CollectionTree } from "../sidebar/CollectionTree";
import { HistoryList } from "../sidebar/HistoryList";
import { WorkspaceSwitcher } from "../sidebar/WorkspaceSwitcher";
import { EnvironmentSelector } from "../common/EnvironmentSelector";

interface SidebarProps {
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onToggle }) => {
  const { t } = useTranslation();
  const [activeKey, setActiveKey] = useState("collections");
  const [searchText, setSearchText] = useState("");

  const tabItems = [
    {
      key: "collections",
      label: (
        <span>
          <ApiOutlined /> {t("collection.title")}
        </span>
      ),
      children: <CollectionTree searchText={searchText} />,
    },
    {
      key: "history",
      label: (
        <span>
          <HistoryOutlined /> {t("history.title")}
        </span>
      ),
      children: <HistoryList />,
    },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <WorkspaceSwitcher />
        <Button
          type="text"
          size="small"
          icon={<MenuFoldOutlined />}
          onClick={onToggle}
          className="sidebar-toggle"
        />
      </div>

      <div className="sidebar-environment">
        <EnvironmentSelector />
      </div>

      <div className="sidebar-search">
        <Input
          size="small"
          placeholder={t("common.search")}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </div>

      <div className="sidebar-content">
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tabItems}
          size="small"
          className="sidebar-tabs"
        />
      </div>
    </div>
  );
};
