import { useEffect, useRef } from "react";
import { useLanguage } from "../../hooks/use-language";
import type { FireworksCelebrationProps } from "./types";

export function useFireworksCelebration(props: FireworksCelebrationProps) {
  const { t } = useLanguage();
  const onCompleteRef = useRef(props.onComplete);

  // Keep the callback reference up to date
  useEffect(() => {
    onCompleteRef.current = props.onComplete;
  });

  useEffect(() => {
    if (props.isActive) {
      const timer = setTimeout(() => {
        onCompleteRef.current();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [props.isActive]); // Only depend on isActive, not onComplete

  return {
    t,
    ...props,
  };
}