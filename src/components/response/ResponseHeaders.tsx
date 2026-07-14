import React from "react";
import { Table } from "antd";
import { useTranslation } from "react-i18next";
import type { KeyValue } from "../../types";

interface ResponseHeadersProps {
  headers: KeyValue[];
}

export const ResponseHeaders: React.FC<ResponseHeadersProps> = ({
  headers,
}) => {
  const { t } = useTranslation();
  const columns = [
    {
      title: t("response.headerName"),
      dataIndex: "key",
      key: "key",
      width: "35%",
      render: (text: string) => (
        <span style={{ fontWeight: 500 }}>{text}</span>
      ),
    },
    {
      title: t("table.value"),
      dataIndex: "value",
      key: "value",
      render: (text: string) => (
        <span style={{ wordBreak: "break-all" as const }}>{text}</span>
      ),
    },
  ];

  return (
    <Table
      dataSource={headers}
      rowKey={(_, index) => String(index)}
      columns={columns}
      size="small"
      pagination={false}
      className="response-headers-table"
    />
  );
};
