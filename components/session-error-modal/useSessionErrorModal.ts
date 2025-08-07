import { useLanguage } from "../../hooks/use-language";
import type { SessionErrorModalProps } from "./types";

export function useSessionErrorModal(props: SessionErrorModalProps) {
  const { t } = useLanguage();
  return {
    t,
    ...props,
  };
}
