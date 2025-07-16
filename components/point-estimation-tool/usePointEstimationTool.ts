import { useCallback, useEffect, useState } from "react";
import { calculateStats, checkAllUsersVoted } from "@/lib/estimation-utils";
import { UserRole } from "@/lib/session-store";
import {
  saveUserData,
  getUserData,
  clearAllData,
  updateUserVote,
  updateSessionState,
  migrateFromOldStorage,
} from "@/lib/persistence";
import { Session, TemplateType } from "@/types/estimation";
import {
  castVote,
  createSessionWithAutoId,
  getSessionData,
  heartbeat,
  joinSessionAsRole,
  resetVotes,
  revealVotes,
  updateTemplate,
  transferHost,
} from "@/app/actions";
import type {
  PointEstimationToolState,
  PointEstimationToolHandlers,
} from "./types";

export function usePointEstimationTool(): PointEstimationToolState &
  PointEstimationToolHandlers & {
    stats: ReturnType<typeof calculateStats> | null;
    allUsersVoted: boolean;
    isHost: boolean;
    canVote: boolean;
    currentUserData: Session["users"][number] | undefined;
  } {
  // 状态
  const [currentUser, setCurrentUser] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("attendance");
  const [session, setSession] = useState<Session | null>(null);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [showSessionErrorModal, setShowSessionErrorModal] = useState(false);

  // 计算属性
  const currentUserData = session?.users.find((u) => u.id === currentUser);
  const isHost = session?.hostId === currentUser;
  const canVote =
    currentUserData?.role === "attendance" || currentUserData?.role === "host";

  // 恢复用户状态
  useEffect(() => {
    const restoreUserState = async () => {
      setIsRestoring(true);
      try {
        await migrateFromOldStorage();
        const storedUserData = await getUserData();
        if (storedUserData) {
          setCurrentUser(storedUserData.userId);
          setUserName(storedUserData.userName);
          setSessionId(storedUserData.sessionId);
          setSelectedRole(storedUserData.role);
          if (storedUserData.lastVote !== undefined) {
            setSelectedVote(storedUserData.lastVote);
          }
          try {
            const result = await getSessionData(storedUserData.sessionId);
            if (result.success && result.session) {
              const userExists = result.session.users.find(
                (u) => u.id === storedUserData.userId
              );
              if (userExists) {
                setSession(result.session);
                setIsJoined(true);
                setIsConnected(true);
                if (!userExists.hasVoted && storedUserData.lastVote) {
                  try {
                    const voteResult = await castVote(
                      storedUserData.sessionId,
                      storedUserData.userId,
                      storedUserData.lastVote
                    );
                    if (voteResult.success && voteResult.session) {
                      setSession(voteResult.session);
                    }
                  } catch (error) {
                    console.error(error);
                    setSelectedVote(null);
                    await updateUserVote(null);
                  }
                }
                return;
              }
            }
          } catch {}
          clearAllData();
        }
        const urlParams = new URLSearchParams(window.location.search);
        const sessionFromUrl = urlParams.get("session");
        if (
          sessionFromUrl &&
          (!storedUserData || storedUserData.sessionId !== sessionFromUrl)
        ) {
          setSessionId(sessionFromUrl);
          setSelectedRole("attendance");
          if (storedUserData) clearAllData();
        } else if (
          sessionFromUrl &&
          storedUserData &&
          storedUserData.sessionId === sessionFromUrl
        ) {
          setSessionId(sessionFromUrl);
          setSelectedRole(storedUserData.role);
        } else if (!sessionFromUrl) {
          setSelectedRole("host");
        }
      } catch {
        clearAllData();
      } finally {
        setIsRestoring(false);
      }
    };
    restoreUserState();
  }, []);

  // 轮询会话数据
  const pollSession = useCallback(async () => {
    if (!sessionId || !currentUser) return;
    try {
      const result = await getSessionData(sessionId);
      if (result.success && result.session) {
        setSession(result.session);
        setIsConnected(true);
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
        const currentUserInSession = result.session.users.find(
          (u) => u.id === currentUser
        );
        if (currentUserInSession) {
          setSelectedVote(currentUserInSession.vote);
          await updateUserVote(currentUserInSession.vote);
        }
      } else {
        setIsConnected(false);
        if (isJoined) {
          performLogout();
        }
      }
    } catch {
      setIsConnected(false);
    }
  }, [sessionId, currentUser, isJoined]);

  // 发送心跳
  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !currentUser) return;
    try {
      await heartbeat(sessionId, currentUser);
    } catch {}
  }, [sessionId, currentUser]);

  // 更新URL
  useEffect(() => {
    if (sessionId && isJoined) {
      const url = new URL(window.location.href);
      url.searchParams.set("session", sessionId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [sessionId, isJoined]);

  // 复制分享链接
  const copyShareLink = async () => {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("session", sessionId);
    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // 轮询和心跳
  useEffect(() => {
    if (!isJoined || isRestoring) return;
    pollSession();
    const pollInterval = setInterval(pollSession, 2000);
    const heartbeatInterval = setInterval(sendHeartbeat, 5000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [isJoined, isRestoring, pollSession, sendHeartbeat]);

  // 事件处理
  const handleCreateSession = async () => {
    if (!userName.trim()) return;
    setIsLoading(true);
    const userId = `${userName}-${Date.now()}`;
    setCurrentUser(userId);
    try {
      const result = await createSessionWithAutoId(userId, userName);
      if (result.success && result.session && result.sessionId) {
        setSession(result.session);
        setSessionId(result.sessionId);
        setIsJoined(true);
        setIsConnected(true);
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
      }
    } catch {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSession = async () => {
    if (!userName.trim() || !sessionId) return;
    setIsLoading(true);
    const userId = `${userName}-${Date.now()}`;
    setCurrentUser(userId);
    try {
      const result = await joinSessionAsRole(
        sessionId,
        userId,
        userName,
        selectedRole
      );
      if (result.success && result.session) {
        setSession(result.session);
        setIsJoined(true);
        setIsConnected(true);
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
      } else {
        setShowSessionErrorModal(true);
      }
    } catch {
      setIsConnected(false);
      setShowSessionErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCastVote = async (vote: string) => {
    if (!session || !currentUser || !canVote) return;
    setSelectedVote(vote);
    await updateUserVote(vote);
    try {
      const result = await castVote(sessionId, currentUser, vote);
      if (result.success && result.session) {
        setSession(result.session);
      }
    } catch {
      const currentUserInSession = session.users.find(
        (u) => u.id === currentUser
      );
      setSelectedVote(currentUserInSession?.vote || null);
      await updateUserVote(currentUserInSession?.vote || null);
    }
  };

  const handleRevealVotes = async () => {
    if (!session || !isHost) return;
    try {
      const result = await revealVotes(sessionId, currentUser);
      if (result.success && result.session) {
        setSession(result.session);
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
      }
    } catch {}
  };

  const handleResetVotes = async () => {
    if (!session || !isHost) return;
    try {
      const result = await resetVotes(sessionId, currentUser);
      if (result.success && result.session) {
        setSession(result.session);
        setSelectedVote(null);
        await updateUserVote(null);
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
        await pollSession();
      }
    } catch {}
  };

  const handleTemplateChange = async (templateType: TemplateType) => {
    if (!session || !isHost) return;
    try {
      const result = await updateTemplate(sessionId, currentUser, templateType);
      if (result.success && result.session) {
        setSession(result.session);
        setSelectedVote(null);
        await updateUserVote(null);
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
        await pollSession();
      }
    } catch {}
  };

  const handleCustomCardsChange = async (newCustomCards: string) => {
    if (!session || !isHost) return;
    try {
      const result = await updateTemplate(
        sessionId,
        currentUser,
        session.template.type as TemplateType,
        newCustomCards
      );
      if (result.success && result.session) {
        setSession(result.session);
        setSelectedVote(null);
        await updateUserVote(null);
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
        await pollSession();
      }
    } catch {}
  };

  const performLogout = () => {
    clearAllData();
    setCurrentUser("");
    setUserName("");
    setSessionId("");
    setSelectedRole("host");
    setSession(null);
    setSelectedVote(null);
    setIsJoined(false);
    setIsConnected(true);
    setIsLoading(false);
    setCopied(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    window.history.replaceState({}, "", url.toString());
  };

  const handleLogout = async () => {
    if (isHost && sessionId && currentUser) {
      try {
        const result = await transferHost(sessionId, currentUser);
        if (result.success && result.session) {
          // 权限转移成功
        } else if (!result.session) {
          // session被删除
        }
      } catch {}
    }
    performLogout();
  };

  const handleBackToHost = () => {
    setShowSessionErrorModal(false);
    clearAllData();
    setSessionId("");
    setSelectedRole("host");
    setCurrentUser("");
    setUserName("");
    setSelectedVote(null);
    setIsJoined(false);
    setIsConnected(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    window.history.replaceState({}, "", url.toString());
  };

  // 统计数据
  const stats = session ? calculateStats(session) : null;
  const allUsersVoted = session ? checkAllUsersVoted(session) : false;

  return {
    currentUser,
    userName,
    sessionId,
    selectedRole,
    session,
    selectedVote,
    isJoined,
    isConnected,
    isLoading,
    copied,
    isRestoring,
    showSessionErrorModal,
    setUserName,
    setSelectedRole,
    setShowSessionErrorModal,
    handleCreateSession,
    handleJoinSession,
    handleCastVote,
    handleRevealVotes,
    handleResetVotes,
    handleTemplateChange,
    handleCustomCardsChange,
    handleLogout,
    handleBackToHost,
    copyShareLink,
    stats,
    allUsersVoted,
    isHost,
    canVote,
    currentUserData,
  };
}
