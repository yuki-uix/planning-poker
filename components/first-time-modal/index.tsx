"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ArrowRight, X } from "lucide-react";
import { useFirstTimeModal } from "./useFirstTimeModal";
import type { FirstTimeModalProps } from "./types";

export function FirstTimeModal(props: FirstTimeModalProps) {
  const { t, isOpen, onStartGuidance, onSkipGuidance } = useFirstTimeModal(props);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px] [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-left">
                {t.firstTimeModal?.title || "Welcome to Planning Poker!"}
              </DialogTitle>
              <DialogDescription className="text-left mt-1">
                {t.firstTimeModal?.description || "Is this your first time creating a session?"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {t.firstTimeModal?.guideDescription || 
                "We'll guide you through the process step by step:"}
            </p>
            <div className="space-y-2 ml-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">1</div>
                <span>{t.firstTimeModal?.step1 || "Enter your name"}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">2</div>
                <span>{t.firstTimeModal?.step2 || "Share session with team"}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">3</div>
                <span>{t.firstTimeModal?.step3 || "Set up estimation template"}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">4</div>
                <span>{t.firstTimeModal?.step4 || "Reveal voting results"}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button
            variant="outline"
            onClick={onSkipGuidance}
            className="w-full sm:w-auto"
          >
            <X className="w-4 h-4 mr-2" />
            {t.firstTimeModal?.skipButton || "Skip"}
          </Button>
          <Button
            onClick={onStartGuidance}
            className="w-full sm:w-auto"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            {t.firstTimeModal?.startButton || "Start Guide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}