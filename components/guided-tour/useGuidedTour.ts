import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../hooks/use-language";
import type { GuidedTourProps } from "./types";

export function useGuidedTour(props: GuidedTourProps) {
  const { t } = useLanguage();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [overlayPosition, setOverlayPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const observerRef = useRef<MutationObserver | null>(null);

  const currentStepData = props.steps[props.currentStep];
  const isLastStep = props.currentStep === props.steps.length - 1;
  const isFirstStep = props.currentStep === 0;
  const totalSteps = props.steps.length;
  const remainingSteps = totalSteps - props.currentStep - 1;

  useEffect(() => {
    if (!props.isActive || !currentStepData) {
      setTargetElement(null);
      return;
    }

    const findAndHighlightTarget = () => {
      const element = document.querySelector(currentStepData.target) as HTMLElement;
      if (element) {
        setTargetElement(element);
        const rect = element.getBoundingClientRect();
        setOverlayPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
        
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    };

    findAndHighlightTarget();

    observerRef.current = new MutationObserver(() => {
      findAndHighlightTarget();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [props.isActive, currentStepData]);

  const handleNext = () => {
    if (currentStepData?.action) {
      currentStepData.action();
    }
    
    if (isLastStep) {
      props.onComplete();
    } else {
      props.onNext();
    }
  };

  return {
    t,
    targetElement,
    overlayPosition,
    currentStepData,
    isLastStep,
    isFirstStep,
    totalSteps,
    remainingSteps,
    currentStep: props.currentStep,
    handleNext,
    onPrevious: props.onPrevious,
    onSkip: props.onSkip,
  };
}