"use client";

import React, { createContext, useContext } from "react";

type AppConfig = {
  timezone: string;
  locale: string;
  dateFormat: string;
  timeFormat: string;
  weekStartsOn: number;
  dictionary: Record<string, string>; // ✅ Ensure this is present
};

const AppConfigContext = createContext<AppConfig | null>(null);

export function AppConfigProvider({
  config,
  children,
}: {
  config: AppConfig;
  children: React.ReactNode;
}) {
  // Optional: Log to debug if the config is arriving correctly
  // console.log("AppConfig Loaded:", config.locale, Object.keys(config.dictionary).length + " keys");

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error("useAppConfig must be used within AppConfigProvider");
  }
  return context;
}