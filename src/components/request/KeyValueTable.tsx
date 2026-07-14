import React from "react";
import { Input, Checkbox, Button } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { KeyValue } from "../../types";

interface KeyValueTableProps {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  showDescription?: boolean;
}

export const KeyValueTable: React.FC<KeyValueTableProps> = ({
  rows,
  onChange,
  showDescription = false,
}) => {
  const { t } = useTranslation();

  const updateRow = (index: number, field: keyof KeyValue, value: unknown) => {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, { key: "", value: "", enabled: true }]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([{ key: "", value: "", enabled: true }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="kv-table">
      <div className="kv-table-header">
        <div className="kv-check" />
        <div className="kv-key">{t("table.key")}</div>
        <div className="kv-value">{t("table.value")}</div>
        {showDescription && (
          <div className="kv-desc">{t("table.description")}</div>
        )}
        <div className="kv-action" />
      </div>
      {rows.map((row, idx) => (
        <div className="kv-table-row" key={idx}>
          <div className="kv-check">
            <Checkbox
              checked={row.enabled}
              onChange={(e) => updateRow(idx, "enabled", e.target.checked)}
            />
          </div>
          <div className="kv-key">
            <Input
              size="small"
              value={row.key}
              onChange={(e) => updateRow(idx, "key", e.target.value)}
              placeholder={t("table.key")}
            />
          </div>
          <div className="kv-value">
            <Input
              size="small"
              value={row.value}
              onChange={(e) => updateRow(idx, "value", e.target.value)}
              placeholder={t("table.value")}
            />
          </div>
          {showDescription && (
            <div className="kv-desc">
              <Input
                size="small"
                value={row.description || ""}
                onChange={(e) =>
                  updateRow(idx, "description", e.target.value)
                }
                placeholder={t("table.description")}
              />
            </div>
          )}
          <div className="kv-action">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeRow(idx)}
              danger
            />
          </div>
        </div>
      ))}
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={addRow}
        className="kv-add-btn"
      >
        {t("table.addRow")}
      </Button>
    </div>
  );
};
