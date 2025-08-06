"use client";

import { Button } from "@/components/ui/button";
import { useLanguageSwitcher } from "./useLanguageSwitcher";
import type { LanguageSwitcherProps } from "./types";
import { Languages } from "lucide-react";

export function LanguageSwitcher(props: LanguageSwitcherProps = {}) {
  const { language, toggleLanguage } = useLanguageSwitcher(props);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-2"
    >
      <Languages className="w-4 h-4" />
      {language === "zh" ? "EN" : "中文"}
    </Button>
  );
}
