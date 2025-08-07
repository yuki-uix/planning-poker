import { useLanguage } from "../../hooks/use-language";
import type { ControlButtonsProps } from "./types";

export function useControlButtons(props: ControlButtonsProps) {
  const { t } = useLanguage();
  return {
    t,
    ...props,
  };
}
