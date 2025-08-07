import { useLanguage } from "../../hooks/use-language";
import type { SessionHeaderProps } from "./types";

export function useSessionHeader(props: SessionHeaderProps) {
  const { session, currentUser, isConnected, copied } = props;
  const { t } = useLanguage();
  const currentUserData = session.users.find((u) => u.id === currentUser);

  return {
    t,
    currentUserData,
    isConnected,
    copied,
    session,
  };
}
