import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppThemeProvider } from "./contexts/ThemeContext";
import "./i18n/config";
import "./monaco";
import "./styles/variables.css";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>
);
