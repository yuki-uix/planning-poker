import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../hooks/use-language";
import type { FireworksCelebrationProps } from "./types";

export function useFireworksCelebration(props: FireworksCelebrationProps) {
  const { t } = useLanguage();
  const onCompleteRef = useRef(props.onComplete);
  const [countdown, setCountdown] = useState(3);

  // Keep the callback reference up to date
  useEffect(() => {
    onCompleteRef.current = props.onComplete;
  });

  useEffect(() => {
    if (props.isActive) {
      setCountdown(3);
      
      // Countdown timer that updates every second
      const countdownTimer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto-dismiss timer
      const dismissTimer = setTimeout(() => {
        onCompleteRef.current();
      }, 3000);

      return () => {
        clearInterval(countdownTimer);
        clearTimeout(dismissTimer);
      };
    }
  }, [props.isActive]);

  const handleManualClose = () => {
    onCompleteRef.current();
  };

  return {
    t,
    countdown,
    handleManualClose,
    ...props,
  };
}