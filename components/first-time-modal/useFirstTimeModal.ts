import { useLanguage } from "../../hooks/use-language";
import type { FirstTimeModalProps } from "./types";

export function useFirstTimeModal(props: FirstTimeModalProps) {
  const { t } = useLanguage();
  
  return {
    t,
    ...props,
  };
}