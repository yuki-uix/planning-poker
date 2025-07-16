"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useThemeProvider } from "./useThemeProvider";
import type { ThemeProviderProps } from "./types";

export function ThemeProvider(props: ThemeProviderProps) {
  const { children, ...rest } = useThemeProvider(props);
  return <NextThemesProvider {...rest}>{children}</NextThemesProvider>;
}
