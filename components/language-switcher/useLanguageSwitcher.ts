import { useLanguage } from "@/hooks/use-language";

export function useLanguageSwitcher() {
  const { language, toggleLanguage } = useLanguage();
  return {
    language,
    toggleLanguage,
  };
}
