"use client";

import { createContext, useContext } from "react";

import { DEFAULT_DISPLAY_LOCALE } from "@/lib/lease/format-app-date";

const DisplayLocaleContext = createContext<string>(DEFAULT_DISPLAY_LOCALE);

export function DisplayLocaleProvider(props: Readonly<{ locale: string; children: React.ReactNode }>) {
  return (
    <DisplayLocaleContext.Provider value={props.locale}>{props.children}</DisplayLocaleContext.Provider>
  );
}

export function useDisplayLocale(): string {
  return useContext(DisplayLocaleContext);
}
