"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ThemeColorPickerProps } from "./types";
import { themeColors, useThemeColorPicker } from "./useThemeColorPicker";

export function ThemeColorPicker({ compact = false }: ThemeColorPickerProps) {
  const { language, colorTheme, handleColorChange } = useThemeColorPicker({
    compact,
  });

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium whitespace-nowrap text-title">
          {language === "zh" ? "主题色:" : "Theme:"}
        </Label>
        <div className="flex gap-1">
          {themeColors.map((colorOption) => (
            <Button
              key={colorOption.value}
              variant={colorTheme === colorOption.value ? "default" : "outline"}
              size="sm"
              className="w-8 h-8 p-0 relative"
              onClick={() => handleColorChange(colorOption.value)}
              style={{
                backgroundColor:
                  colorTheme === colorOption.value
                    ? colorOption.color
                    : "transparent",
                borderColor: colorOption.color,
              }}
              title={
                colorOption.name[language as keyof typeof colorOption.name]
              }
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colorOption.color }}
              />
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <Label className="text-sm font-medium mb-3 block text-title">
          {language === "zh" ? "主题色" : "Theme Color"}
        </Label>
        <div className="flex gap-2">
          {themeColors.map((colorOption) => (
            <Button
              key={colorOption.value}
              variant={colorTheme === colorOption.value ? "default" : "outline"}
              size="sm"
              className="flex-1 h-10 relative"
              onClick={() => handleColorChange(colorOption.value)}
              style={{
                backgroundColor:
                  colorTheme === colorOption.value
                    ? colorOption.color
                    : "transparent",
                borderColor: colorOption.color,
                color:
                  colorTheme === colorOption.value
                    ? "white"
                    : colorOption.color,
              }}
            >
              <div
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: colorOption.color }}
              />
              {colorOption.name[language as keyof typeof colorOption.name]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
