import React, { useState } from "react";
import { useLanguage } from "../../hooks/use-language";
import type { ThemeColorPickerProps } from "./types";

export const themeColors = [
  { name: { zh: "青色", en: "Cyan" }, value: "cyan", color: "#48a1ad" },
  { name: { zh: "绿色", en: "Green" }, value: "green", color: "#6b9e78" },
  { name: { zh: "紫色", en: "Purple" }, value: "purple", color: "#634f7d" },
  { name: { zh: "橙色", en: "Orange" }, value: "orange", color: "#cc8508" },
  { name: { zh: "粉色", en: "Pink" }, value: "pink", color: "#e16a7b" },
  { name: { zh: "深蓝", en: "Navy" }, value: "navy", color: "#163c4d" },
];

export function useThemeColorPicker(props: ThemeColorPickerProps) {
  const { language } = useLanguage();
  const [colorTheme, setColorTheme] = useState("cyan");

  React.useEffect(() => {
    const savedColorTheme = localStorage.getItem("color-theme");
    if (savedColorTheme) {
      setColorTheme(savedColorTheme);
      document.documentElement.setAttribute(
        "data-color-theme",
        savedColorTheme
      );
    } else {
      localStorage.setItem("color-theme", "cyan");
      document.documentElement.setAttribute("data-color-theme", "cyan");
    }
  }, []);

  const handleColorChange = (colorValue: string) => {
    setColorTheme(colorValue);
    localStorage.setItem("color-theme", colorValue);
    document.documentElement.setAttribute("data-color-theme", colorValue);
  };

  return {
    language,
    colorTheme,
    setColorTheme,
    handleColorChange,
    themeColors,
    ...props,
  };
}
