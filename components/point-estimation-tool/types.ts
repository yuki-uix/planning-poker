import type { Session, TemplateType } from "@/types/estimation";
import type { UserRole } from "@/lib/session-store";

export interface PointEstimationToolState {
  currentUser: string;
  userName: string;
  sessionId: string;
  selectedRole: UserRole;
  session: Session | null;
  selectedVote: string | null;
  isJoined: boolean;
  isConnected: boolean;
  isLoading: boolean;
  copied: boolean;
  isRestoring: boolean;
  showSessionErrorModal: boolean;
}

export interface PointEstimationToolHandlers {
  handleCreateSession: () => Promise<void>;
  handleJoinSession: () => Promise<void>;
  handleCastVote: (vote: string) => Promise<void>;
  handleRevealVotes: () => Promise<void>;
  handleResetVotes: () => Promise<void>;
  handleTemplateChange: (templateType: TemplateType) => Promise<void>;
  handleCustomCardsChange: (newCustomCards: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleBackToHost: () => void;
  copyShareLink: () => Promise<void>;
  setUserName: (name: string) => void;
  setSelectedRole: (role: UserRole) => void;
  setShowSessionErrorModal: (open: boolean) => void;
}
