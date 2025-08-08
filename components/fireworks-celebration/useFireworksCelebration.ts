import { useEffect } from "react";
import { useLanguage } from "../../hooks/use-language";
import type { FireworksCelebrationProps } from "./types";

export function useFireworksCelebration(props: FireworksCelebrationProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (props.isActive) {
      const timer = setTimeout(() => {
        props.onComplete();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [props.isActive, props.onComplete]);

  return {
    t,
    ...props,
  };
}