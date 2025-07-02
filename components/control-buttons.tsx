"use client";

import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { Session } from "@/types/estimation";

interface ControlButtonsProps {
  session: Session;
  isHost: boolean;
  allUsersVoted: boolean;
  onRevealVotes: () => void;
  onResetVotes: () => void;
}

export function ControlButtons({
  session,
  isHost,
  allUsersVoted,
  onRevealVotes,
  onResetVotes,
}: ControlButtonsProps) {
  const { t } = useLanguage();

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
