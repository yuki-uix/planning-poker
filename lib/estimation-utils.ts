import {
  Session,
  EstimationStats,
  TemplateType,
  ESTIMATION_TEMPLATES,
} from "../types/estimation";

export function getCurrentEstimationCards(session: Session): string[] {
  const selectedTemplate =
    (session.template?.type as TemplateType) || "fibonacci";
  const customCards = session.template?.customCards || "☕️,1,2,3,5,8,13";

  if (selectedTemplate === "custom") {
    return customCards
      .split(",")
      .map((card) => card.trim())
      .filter((card) => card.length > 0);
  }
  return [...ESTIMATION_TEMPLATES[selectedTemplate].cards];
}

export function calculateStats(session: Session): EstimationStats | null {
  if (!session.revealed) return null;

  // 只获取attendance和host角色的用户投票
  const votingUsers = session.users.filter(
    (user) => user.role === "attendance" || user.role === "host"
  );
  
  const votes = votingUsers
    .filter((user) => user.hasVoted && user.vote)
    .map((user) => user.vote!);
    
  const numericVotes = votes
    .filter((vote) => vote !== "☕️")
    .map((vote) => Number.parseFloat(vote))
    .filter((vote) => !isNaN(vote));

  const currentEstimationCards = getCurrentEstimationCards(session);
  const distribution = currentEstimationCards.reduce(
    (acc: Record<string, number>, card: string) => {
      const count = votes.filter((vote: string) => vote === card).length;
      if (count > 0) {
        acc[card] = count;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const average =
    numericVotes.length > 0
      ? numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length
      : 0;

  return {
    distribution,
    average: Math.round(average * 10) / 10,
    totalVotes: votes.length,
    validVotes: numericVotes.length,
  };
}

export function checkAllUsersVoted(session: Session): boolean {
  return session.users
    .filter((u) => u.role === "attendance" || u.role === "host")
    .every((user) => user.hasVoted);
}
