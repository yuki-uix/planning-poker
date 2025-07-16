import type { Session } from "@/types/estimation";

export interface SessionHeaderProps {
  session: Session;
  sessionId: string;
  userName: string;
  currentUser: string;
  isConnected: boolean;
  copied: boolean;
  onCopyShareLink: () => void;
  onLogout: () => void;
}
