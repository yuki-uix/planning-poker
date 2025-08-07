import { useLanguage } from "../../hooks/use-language";
import type { UserStatusProps } from "./types";
import type { User } from "../../types/estimation";

export function useUserStatus(props: UserStatusProps) {
  const { session, currentUser } = props;
  const { t } = useLanguage();

  // 分离已投票和未投票的用户
  const votedUsers = session.users.filter(
    (user) =>
      user.hasVoted && (user.role === "attendance" || user.role === "host")
  );
  const notVotedUsers = session.users.filter(
    (user) =>
      !user.hasVoted && (user.role === "attendance" || user.role === "host")
  );
  const guestUsers = session.users.filter((user) => user.role === "guest");

  const renderUserCardProps = (user: User) => {
    return {
      isCurrent: user.id === currentUser,
      name: user.name,
      role: user.role,
      hasVoted: user.hasVoted,
      vote: user.vote,
    };
  };

  return {
    t,
    votedUsers,
    notVotedUsers,
    guestUsers,
    renderUserCardProps,
    session,
    currentUser,
  };
}
