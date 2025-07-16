import type { UserRole } from "@/lib/session-store";

export interface LoginFormProps {
  sessionId?: string;
  userName: string;
  setUserName: (name: string) => void;
  selectedRole: UserRole;
  setSelectedRole: (role: UserRole) => void;
  isLoading: boolean;
  onCreateSession: () => void;
  onJoinSession: () => void;
}
