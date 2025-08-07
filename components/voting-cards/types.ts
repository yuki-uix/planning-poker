import type { Session } from "../../types/estimation";

export interface VotingCardsProps {
  session: Session;
  currentUser: string;
  selectedVote: string | null;
  canVote: boolean;
  onCastVote: (vote: string) => void;
}
