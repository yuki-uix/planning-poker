"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, X, Target } from "lucide-react";
import { useGuidedTour } from "./useGuidedTour";
import type { GuidedTourProps } from "./types";

export function GuidedTour(props: GuidedTourProps) {
  const {
    t,
    targetElement,
    overlayPosition,
    currentStepData,
    isLastStep,
    isFirstStep,
    totalSteps,
    remainingSteps,
    currentStep,
    handleNext,
    onPrevious,
    onSkip,
  } = useGuidedTour(props);

  if (!props.isActive || !currentStepData) {
    return null;
  }

  const getTooltipPosition = () => {
    if (!targetElement) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const rect = overlayPosition;
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const padding = 20;

    let top = rect.top;
    let left = rect.left;

    switch (currentStepData.position) {
      case "top":
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.top + rect.height + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left + rect.width + padding;
        break;
    }

    const maxLeft = window.innerWidth - tooltipWidth - 20;
    const maxTop = window.innerHeight - tooltipHeight - 20;
    
    left = Math.max(20, Math.min(left, maxLeft));
    top = Math.max(20, Math.min(top, maxTop));

    return {
      position: "fixed" as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 10002,
    };
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[10000]"
        style={{ pointerEvents: "none" }}
      />
      
      {targetElement && (
        <div
          className="fixed border-2 border-blue-500 rounded-lg shadow-lg z-[10001] animate-pulse"
          style={{
            top: `${overlayPosition.top - 4}px`,
            left: `${overlayPosition.left - 4}px`,
            width: `${overlayPosition.width + 8}px`,
            height: `${overlayPosition.height + 8}px`,
            pointerEvents: "none",
            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.3)",
          }}
        />
      )}

      <Card 
        className="shadow-xl border-2 border-blue-200 bg-white"
        style={getTooltipPosition()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  {currentStepData.title}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    Step {currentStep + 1} of {totalSteps}
                  </span>
                  {remainingSteps > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {remainingSteps} remaining
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <CardDescription className="text-sm text-foreground mb-4">
            {currentStepData.description}
          </CardDescription>

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevious}
                disabled={isFirstStep}
                className="h-9"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t.guidedTour?.previousButton || "Previous"}
              </Button>
            </div>

            <Button
              onClick={handleNext}
              size="sm"
              className="h-9 bg-blue-600 hover:bg-blue-700"
            >
              {isLastStep ? (
                <>
                  {t.guidedTour?.completeButton || "Complete"}
                  <Target className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  {t.guidedTour?.nextButton || "Next"}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}