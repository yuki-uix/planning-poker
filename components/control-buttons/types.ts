import type { Session } from "@/types/estimation";

export interface ControlButtonsProps {
  session: Session;
  isHost: boolean;
  allUsersVoted: boolean;
  onRevealVotes: () => void;
  onResetVotes: () => void;
}
