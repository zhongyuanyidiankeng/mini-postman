import React, { useState, useEffect } from "react";
import { Spin } from "antd";
import { useTranslation } from "react-i18next";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { TabProvider } from "./contexts/TabContext";
import { EnvironmentProvider } from "./contexts/EnvironmentContext";
import { AppLayout } from "./components/layout/AppLayout";
import { initDatabase } from "./services/database";

const App: React.FC = () => {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="app-loading">
        <p style={{ color: "#ff4d4f" }}>
          {t("app.initFailed", { error })}
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <EnvironmentProvider>
        <TabProvider>
          <AppLayout />
        </TabProvider>
      </EnvironmentProvider>
    </WorkspaceProvider>
  );
};

export default App;
