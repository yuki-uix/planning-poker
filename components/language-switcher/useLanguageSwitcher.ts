import { useLanguage } from "@/hooks/use-language";
import type { LanguageSwitcherProps } from "./types";

export function useLanguageSwitcher(props?: LanguageSwitcherProps) {
  const { language, toggleLanguage } = useLanguage();
  return {
    language,
    toggleLanguage,
    ...props,
  };
}
