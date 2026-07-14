import React, { createContext, useContext, useEffect, useState } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useTranslation } from "react-i18next";

export type BackgroundTheme =
  | "midnight"
  | "graphite"
  | "forest"
  | "warm"
  | "ocean"
  | "white"
  | "mist";

export const BACKGROUND_STORAGE_KEY = "mini-postman:background-theme";

export const BACKGROUND_THEMES: Array<{
  key: BackgroundTheme;
  labelKey: string;
  color: string;
  secondary: string;
  elevated: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  isLight: boolean;
}> = [
  {
    key: "midnight",
    labelKey: "theme.midnight",
    color: "#0f0f1a",
    secondary: "#1a1a2e",
    elevated: "#1e1e3a",
    border: "#2a2a4a",
    text: "#e4e4f0",
    textSecondary: "#8888aa",
    accent: "#6366f1",
    isLight: false,
  },
  {
    key: "graphite",
    labelKey: "theme.graphite",
    color: "#111315",
    secondary: "#181b1f",
    elevated: "#242930",
    border: "#323942",
    text: "#eef1f4",
    textSecondary: "#98a2ad",
    accent: "#5b8def",
    isLight: false,
  },
  {
    key: "forest",
    labelKey: "theme.forest",
    color: "#071713",
    secondary: "#0d211c",
    elevated: "#16382f",
    border: "#245247",
    text: "#e5f2ee",
    textSecondary: "#8eb5a9",
    accent: "#3fb98b",
    isLight: false,
  },
  {
    key: "warm",
    labelKey: "theme.warm",
    color: "#181512",
    secondary: "#211d18",
    elevated: "#342c22",
    border: "#4a3d2d",
    text: "#f2ece3",
    textSecondary: "#b5a793",
    accent: "#d58b4b",
    isLight: false,
  },
  {
    key: "ocean",
    labelKey: "theme.ocean",
    color: "#081923",
    secondary: "#0d2531",
    elevated: "#153847",
    border: "#245064",
    text: "#e6f3f7",
    textSecondary: "#8cb3c2",
    accent: "#2ea9c7",
    isLight: false,
  },
  {
    key: "white",
    labelKey: "theme.white",
    color: "#ffffff",
    secondary: "#f6f7f9",
    elevated: "#ffffff",
    border: "#d9dde3",
    text: "#20242a",
    textSecondary: "#667085",
    accent: "#2563eb",
    isLight: true,
  },
  {
    key: "mist",
    labelKey: "theme.mist",
    color: "#eef1f5",
    secondary: "#e4e8ed",
    elevated: "#f8fafc",
    border: "#cbd2da",
    text: "#252a31",
    textSecondary: "#65717e",
    accent: "#0f766e",
    isLight: true,
  },
];

export const isBackgroundTheme = (
  value: string | null
): value is BackgroundTheme =>
  BACKGROUND_THEMES.some((item) => item.key === value);

type ActiveBackground = (typeof BACKGROUND_THEMES)[number];

interface ThemeState {
  backgroundTheme: BackgroundTheme;
  setBackgroundTheme: (theme: BackgroundTheme) => void;
  activeBackground: ActiveBackground;
}

const ThemeContext = createContext<ThemeState>(null!);

export const useAppTheme = () => useContext(ThemeContext);

function initialBackgroundTheme(): BackgroundTheme {
  const stored = localStorage.getItem(BACKGROUND_STORAGE_KEY);
  const selected = isBackgroundTheme(stored) ? stored : "midnight";
  document.documentElement.dataset.bgTheme = selected;
  return selected;
}

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { i18n } = useTranslation();
  const [backgroundTheme, setBackgroundTheme] =
    useState<BackgroundTheme>(initialBackgroundTheme);
  const activeBackground =
    BACKGROUND_THEMES.find((item) => item.key === backgroundTheme) ||
    BACKGROUND_THEMES[0];
  const activeLanguage = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";

  useEffect(() => {
    document.documentElement.dataset.bgTheme = backgroundTheme;
    localStorage.setItem(BACKGROUND_STORAGE_KEY, backgroundTheme);
  }, [backgroundTheme]);

  return (
    <ThemeContext.Provider
      value={{ backgroundTheme, setBackgroundTheme, activeBackground }}
    >
      <ConfigProvider
        locale={activeLanguage === "zh" ? zhCN : enUS}
        theme={{
          algorithm: activeBackground.isLight
            ? antdTheme.defaultAlgorithm
            : antdTheme.darkAlgorithm,
          token: {
            colorPrimary: activeBackground.accent,
            colorBgBase: activeBackground.color,
            colorBgLayout: activeBackground.color,
            colorBgContainer: activeBackground.secondary,
            colorBgElevated: activeBackground.elevated,
            colorBorder: activeBackground.border,
            colorText: activeBackground.text,
            colorTextSecondary: activeBackground.textSecondary,
            borderRadius: 6,
            fontSize: 13,
          },
          components: {
            Layout: {
              bodyBg: activeBackground.color,
              siderBg: activeBackground.secondary,
            },
            Menu: {
              darkItemBg: "transparent",
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};
