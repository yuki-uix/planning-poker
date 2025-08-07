"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useControlButtons } from "./useControlButtons";
import type { ControlButtonsProps } from "./types";

export function ControlButtons(props: ControlButtonsProps) {
  const { t, session, isHost, allUsersVoted, onRevealVotes, onResetVotes } =
    useControlButtons(props);

  if (!isHost) return null;

  return (
    <div className="flex gap-4 justify-center">
      <Button
        onClick={onRevealVotes}
        disabled={!allUsersVoted || session.revealed}
        className="flex items-center gap-2"
      >
        <Eye className="w-4 h-4" />
        {t.voting.revealButton} (
        {session.users.filter(
          (u) => (u.role === "attendance" || u.role === "host") && u.hasVoted
        ).length || 0}
        /
        {session.users.filter(
          (u) => u.role === "attendance" || u.role === "host"
        ).length || 0}
        )
      </Button>
      <Button
        onClick={onResetVotes}
        variant="outline"
        className="flex items-center gap-2 bg-transparent"
      >
        {t.voting.resetButton}
      </Button>
    </div>
  );
}
