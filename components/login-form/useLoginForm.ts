import { useLanguage } from "@/hooks/use-language";
import type { LoginFormProps } from "./types";

export function useLoginForm(props: LoginFormProps) {
  const { t } = useLanguage();
  return {
    t,
    ...props,
  };
}
