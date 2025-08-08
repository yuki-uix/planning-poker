export interface GuidedTourStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: "top" | "bottom" | "left" | "right";
  action?: () => void;
}

export interface GuidedTourProps {
  isActive: boolean;
  currentStep: number;
  steps: GuidedTourStep[];
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onComplete: () => void;
}