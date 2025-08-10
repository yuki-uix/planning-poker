import { useState, useEffect } from "react";
import { userGuidanceStore } from "../lib/user-guidance-store";
import type { GuidedTourStep } from "../components/guided-tour/types";

export function useUserGuidance() {
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [isGuidanceActive, setIsGuidanceActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showFireworks, setShowFireworks] = useState(false);

  const guidanceSteps: GuidedTourStep[] = [
    {
      id: "welcome-session",
      title: "Welcome to Your Session",
      description: "Great! You've created your planning poker session. Your name is now displayed here and visible to all participants.",
      target: "[data-guidance-welcome]",
      position: "bottom",
    },
    {
      id: "share-link",
      title: "Share Session",
      description: "Click the share button to copy the session link. Send this link to your team members so they can join the session.",
      target: "[data-guidance-share]",
      position: "bottom",
    },
    {
      id: "template-settings",
      title: "Choose Estimation Template",
      description: "Select your estimation template. We recommend trying the Custom template to create your own estimation values.",
      target: "[data-guidance-template]",
      position: "top",
    },
    {
      id: "reveal-votes",
      title: "Reveal Results",
      description: "Once team members have voted, click the Reveal button to show everyone's estimates and discuss the results.",
      target: "[data-guidance-reveal]",
      position: "top",
    },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenGuidance = userGuidanceStore.hasSeenHostGuidance();
      if (!hasSeenGuidance) {
        const timer = setTimeout(() => {
          setShowFirstTimeModal(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const startGuidance = () => {
    setShowFirstTimeModal(false);
    setIsGuidanceActive(true);
    setCurrentStep(0);
    userGuidanceStore.startGuidance();
  };

  const skipGuidance = () => {
    setShowFirstTimeModal(false);
    setIsGuidanceActive(false);
    userGuidanceStore.skipGuidance();
  };

  const nextStep = () => {
    const nextStepIndex = currentStep + 1;
    if (nextStepIndex < guidanceSteps.length) {
      setCurrentStep(nextStepIndex);
      userGuidanceStore.setCurrentStep(nextStepIndex);
    }
  };

  const previousStep = () => {
    const prevStepIndex = currentStep - 1;
    if (prevStepIndex >= 0) {
      setCurrentStep(prevStepIndex);
      userGuidanceStore.setCurrentStep(prevStepIndex);
    }
  };

  const completeGuidance = () => {
    setIsGuidanceActive(false);
    setShowFireworks(true);
    userGuidanceStore.completeGuidance();
  };

  const finishFireworks = () => {
    setShowFireworks(false);
  };

  return {
    showFirstTimeModal,
    isGuidanceActive,
    currentStep,
    showFireworks,
    guidanceSteps,
    startGuidance,
    skipGuidance,
    nextStep,
    previousStep,
    completeGuidance,
    finishFireworks,
  };
}