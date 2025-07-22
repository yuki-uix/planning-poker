import { useCallback } from "react";
import { UserRole } from "@/lib/session-store";
import { Session, TemplateType } from "@/types/estimation";
import {
  createSessionWithAutoId,
  joinSessionAsRole,
  castVote,
  revealVotes,
  resetVotes,
  updateTemplate,
  leaveSession,
} from "@/app/actions";
import { saveUserData, updateUserVote } from "@/lib/persistence";

export interface SessionActions {
  handleCreateSession: (userName: string, userId: string) => Promise<boolean>;
  handleJoinSession: (userName: string, sessionId: string, selectedRole: UserRole, userId: string) => Promise<boolean>;
  handleCastVote: (sessionId: string, currentUser: string, vote: string, session: Session, canVote: boolean) => Promise<void>;
  handleRevealVotes: (sessionId: string, currentUser: string, session: Session, isHost: boolean) => Promise<void>;
  handleResetVotes: (sessionId: string, currentUser: string, session: Session, isHost: boolean, setSelectedVote: (vote: string | null) => void, pollSession: () => Promise<void>) => Promise<void>;
  handleTemplateChange: (sessionId: string, currentUser: string, session: Session, isHost: boolean, templateType: TemplateType, setSelectedVote: (vote: string | null) => void, pollSession: () => Promise<void>) => Promise<void>;
  handleCustomCardsChange: (sessionId: string, currentUser: string, session: Session, isHost: boolean, newCustomCards: string, setSelectedVote: (vote: string | null) => void, pollSession: () => Promise<void>) => Promise<void>;
  handleLogout: (sessionId: string, currentUser: string, isHost: boolean) => Promise<void>;
}

export function useSessionActions(): SessionActions {
  const handleCreateSession = useCallback(async (
    userName: string,
    userId: string
  ): Promise<boolean> => {
    if (!userName.trim()) return false;
    try {
      const result = await createSessionWithAutoId(userId, userName);
      if (result.success && result.session && result.sessionId) {
        await saveUserData({
          userId,
          userName,
          sessionId: result.sessionId,
          role: "host",
          lastVote: null,
          lastSessionState: {
            revealed: result.session.revealed,
            template: result.session.template,
          },
        });
        return true;
      } else {
        console.error('Failed to create session:', result.error || 'Unknown error');
        return false;
      }
    } catch (error) {
      console.error('Exception during session creation:', error);
      return false;
    }
  }, []);

  const handleJoinSession = useCallback(async (
    userName: string,
    sessionId: string,
    selectedRole: UserRole,
    userId: string
  ): Promise<boolean> => {
    if (!userName.trim() || !sessionId) return false;
    try {
      const result = await joinSessionAsRole(
        sessionId,
        userId,
        userName,
        selectedRole
      );
      if (result.success && result.session) {
        await saveUserData({
          userId,
          userName,
          sessionId,
          role: selectedRole,
          lastVote: null,
          lastSessionState: {
            revealed: result.session.revealed,
            template: result.session.template,
          },
        });
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }, []);

  const handleCastVote = useCallback(async (
    sessionId: string,
    currentUser: string,
    vote: string,
    session: Session,
    canVote: boolean
  ): Promise<void> => {
    if (!session || !currentUser || !canVote) return;
    await updateUserVote(vote);
    try {
      await castVote(sessionId, currentUser, vote);
    } catch {
      const currentUserInSession = session.users.find(
        (u) => u.id === currentUser
      );
      await updateUserVote(currentUserInSession?.vote || null);
    }
  }, []);

  const handleRevealVotes = useCallback(async (
    sessionId: string,
    currentUser: string,
    session: Session,
    isHost: boolean
  ): Promise<void> => {
    if (!session || !isHost) return;
    try {
      await revealVotes(sessionId, currentUser);
    } catch {}
  }, []);

  const handleResetVotes = useCallback(async (
    sessionId: string,
    currentUser: string,
    session: Session,
    isHost: boolean,
    setSelectedVote: (vote: string | null) => void,
    pollSession: () => Promise<void>
  ): Promise<void> => {
    if (!session || !isHost) return;
    try {
      const result = await resetVotes(sessionId, currentUser);
      if (result.success && result.session) {
        setSelectedVote(null);
        await updateUserVote(null);
        await pollSession();
      }
    } catch {}
  }, []);

  const handleTemplateChange = useCallback(async (
    sessionId: string,
    currentUser: string,
    session: Session,
    isHost: boolean,
    templateType: TemplateType,
    setSelectedVote: (vote: string | null) => void,
    pollSession: () => Promise<void>
  ): Promise<void> => {
    if (!session || !isHost) return;
    try {
      const result = await updateTemplate(sessionId, currentUser, templateType);
      if (result.success && result.session) {
        setSelectedVote(null);
        await updateUserVote(null);
        await pollSession();
      }
    } catch {}
  }, []);

  const handleCustomCardsChange = useCallback(async (
    sessionId: string,
    currentUser: string,
    session: Session,
    isHost: boolean,
    newCustomCards: string,
    setSelectedVote: (vote: string | null) => void,
    pollSession: () => Promise<void>
  ): Promise<void> => {
    if (!session || !isHost) return;
    try {
      const result = await updateTemplate(
        sessionId,
        currentUser,
        session.template.type as TemplateType,
        newCustomCards
      );
      if (result.success && result.session) {
        setSelectedVote(null);
        await updateUserVote(null);
        await pollSession();
      }
    } catch {}
  }, []);

  const handleLogout = useCallback(async (
    sessionId: string,
    currentUser: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _isHost: boolean
  ): Promise<void> => {
    if (sessionId && currentUser) {
      try {
        // 直接从会话中移除用户
        await leaveSession(sessionId, currentUser);
      } catch {}
    }
  }, []);

  return {
    handleCreateSession,
    handleJoinSession,
    handleCastVote,
    handleRevealVotes,
    handleResetVotes,
    handleTemplateChange,
    handleCustomCardsChange,
    handleLogout,
  };
} 