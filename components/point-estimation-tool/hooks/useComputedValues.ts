import { useMemo } from "react";
import { calculateStats, checkAllUsersVoted } from "../../../lib/estimation-utils";
import { Session } from "../../../types/estimation";

export interface ComputedValues {
  stats: ReturnType<typeof calculateStats> | null;
  allUsersVoted: boolean;
  isHost: boolean;
  canVote: boolean;
  currentUserData: Session["users"][number] | undefined;
}

export function useComputedValues(
  session: Session | null,
  currentUser: string
): ComputedValues {
  const computedValues = useMemo(() => {
    const currentUserData = session?.users.find((u) => u.id === currentUser);
    const isHost = session?.hostId === currentUser;
    const canVote =
      currentUserData?.role === "attendance" || currentUserData?.role === "host";
    const stats = session ? calculateStats(session) : null;
    const allUsersVoted = session ? checkAllUsersVoted(session) : false;

    return {
      stats,
      allUsersVoted,
      isHost,
      canVote,
      currentUserData,
    };
  }, [session, currentUser]);

  return computedValues;
} 