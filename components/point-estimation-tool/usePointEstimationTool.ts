/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect } from "react";
import { Session, TemplateType } from "@/types/estimation";
import {
  useUserState,
  useSessionState,
  useSessionActions,
  useUIState,
  useComputedValues,
} from "./hooks";
import type {
  PointEstimationToolState,
  PointEstimationToolHandlers,
} from "./types";

export function usePointEstimationTool(): PointEstimationToolState &
  PointEstimationToolHandlers & {
    stats: ReturnType<
      typeof import("@/lib/estimation-utils").calculateStats
    > | null;
    allUsersVoted: boolean;
    isHost: boolean;
    canVote: boolean;
    currentUserData: Session["users"][number] | undefined;
  } {
  // 使用子hooks
  const userState = useUserState();
  const sessionState = useSessionState(
    userState.sessionId,
    userState.currentUser,
    userState.isJoined,
    userState.isRestoring,
    userState.setIsJoined
  );
  const sessionActions = useSessionActions();
  const uiState = useUIState();
  const computedValues = useComputedValues(
    sessionState.session,
    userState.currentUser
  );

  // 更新URL
  useEffect(() => {
    uiState.updateURL(userState.sessionId, sessionState.isJoined);
  }, [userState.sessionId, sessionState.isJoined, uiState]);

  // 处理创建会话
  const handleCreateSession = useCallback(async () => {
    if (!userState.userName.trim()) return;
    sessionState.setIsLoading(true);
    uiState.setErrorMessage(null); // 清除之前的错误信息
    const userId = `${userState.userName}-${Date.now()}`;
    try {
      const result = await sessionActions.handleCreateSession(
        userState.userName,
        userId
      );
      if (result) {
        userState.setCurrentUser(userId);
        // 从 getUserData 获取 sessionId
        const userData = await import("@/lib/persistence").then((m) =>
          m.getUserData()
        );
        if (userData) {
          userState.setSessionId(userData.sessionId);
        }
        userState.setIsJoined(true);
        sessionState.setIsConnected(true);
      } else {
        sessionState.setIsConnected(false);
        console.error('Failed to create session: result is false');
        uiState.setErrorMessage('创建会话失败，请检查网络连接或稍后重试');
        uiState.setShowSessionErrorModal(true);
      }
    } catch (error) {
      sessionState.setIsConnected(false);
      console.error('Failed to create session:', error);
      const errorMsg = error instanceof Error ? error.message : '创建会话时发生未知错误';
      uiState.setErrorMessage(`创建会话失败: ${errorMsg}`);
      uiState.setShowSessionErrorModal(true);
    } finally {
      sessionState.setIsLoading(false);
    }
  }, [
    userState.userName,
    userState.setCurrentUser,
    userState.setSessionId,
    userState.setIsJoined,
    sessionState,
    sessionActions,
    uiState,
  ]);

  // 处理加入会话
  const handleJoinSession = useCallback(async () => {
    if (!userState.userName.trim() || !userState.sessionId) return;
    sessionState.setIsLoading(true);
    const userId = `${userState.userName}-${Date.now()}`;
    try {
      const result = await sessionActions.handleJoinSession(
        userState.userName,
        userState.sessionId,
        userState.selectedRole,
        userId
      );
      if (result) {
        userState.setCurrentUser(userId);
        userState.setSessionId(userState.sessionId);
        userState.setIsJoined(true);
        sessionState.setIsConnected(true);
      } else {
        sessionState.setIsConnected(false);
        uiState.setShowSessionErrorModal(true);
      }
    } catch {
      sessionState.setIsConnected(false);
      uiState.setShowSessionErrorModal(true);
    } finally {
      sessionState.setIsLoading(false);
    }
  }, [
    userState.userName,
    userState.sessionId,
    userState.selectedRole,
    userState.currentUser,
    userState.setCurrentUser,
    userState.setSessionId,
    userState.setIsJoined,
    sessionState,
    sessionActions,
    uiState,
  ]);

  // 处理投票
  const handleCastVote = useCallback(
    async (vote: string) => {
      if (
        !sessionState.session ||
        !userState.currentUser ||
        !computedValues.canVote
      )
        return;
      userState.setSelectedVote(vote);
      await sessionState.sendVote(vote);
    },
    [sessionState, userState.currentUser, userState.setSelectedVote, computedValues.canVote]
  );

  // 处理显示投票
  const handleRevealVotes = useCallback(async () => {
    if (!sessionState.session || !computedValues.isHost) return;
    await sessionState.sendReveal();
  }, [sessionState, computedValues.isHost]);

  // 处理重置投票
  const handleResetVotes = useCallback(async () => {
    if (!sessionState.session || !computedValues.isHost) return;
    await sessionState.sendReset();
  }, [sessionState, computedValues.isHost]);

  // 处理模板变更
  const handleTemplateChange = useCallback(
    async (templateType: TemplateType) => {
      if (!sessionState.session || !computedValues.isHost) return;
      await sessionState.sendTemplateUpdate({ type: templateType });
    },
    [sessionState, computedValues.isHost]
  );

  // 处理自定义卡片变更
  const handleCustomCardsChange = useCallback(
    async (newCustomCards: string) => {
      if (!sessionState.session || !computedValues.isHost) return;
      await sessionState.sendTemplateUpdate({ 
        type: 'custom', 
        customCards: newCustomCards 
      });
    },
    [sessionState, computedValues.isHost]
  );

  // 处理登出
  const handleLogout = useCallback(async () => {
    await sessionActions.handleLogout(
      userState.sessionId,
      userState.currentUser,
      computedValues.isHost
    );
    userState.clearUserState();
    sessionState.setSession(null);
    sessionState.setIsJoined(false);
    sessionState.setIsConnected(true);
    sessionState.setIsLoading(false);
    uiState.clearURL();
  }, [userState.sessionId, userState.currentUser, userState.clearUserState, sessionState, sessionActions, uiState, computedValues.isHost]);

  // 处理返回主机
  const handleBackToHost = useCallback(() => {
    uiState.setShowSessionErrorModal(false);
    userState.clearUserState();
    sessionState.setSession(null);
    sessionState.setIsJoined(false);
    sessionState.setIsConnected(true);
    uiState.clearURL();
  }, [userState.clearUserState, sessionState, uiState]);

  return {
    // 状态
    currentUser: userState.currentUser,
    userName: userState.userName,
    sessionId: userState.sessionId,
    selectedRole: userState.selectedRole,
    session: sessionState.session,
    selectedVote: userState.selectedVote,
    isJoined: userState.isJoined,
    isConnected: sessionState.isConnected,
    isLoading: sessionState.isLoading,
    copied: uiState.copied,
    isRestoring: userState.isRestoring,
    showSessionErrorModal: uiState.showSessionErrorModal,
    errorMessage: uiState.errorMessage,

    // 处理函数
    setUserName: userState.setUserName,
    setSelectedRole: userState.setSelectedRole,
    handleCreateSession,
    handleJoinSession,
    handleCastVote,
    handleRevealVotes,
    handleResetVotes,
    handleTemplateChange,
    handleCustomCardsChange,
    handleLogout,
    handleBackToHost,
    copyShareLink: () => uiState.copyShareLink(userState.sessionId),
    setShowSessionErrorModal: uiState.setShowSessionErrorModal,

    // 计算值
    stats: computedValues.stats,
    allUsersVoted: computedValues.allUsersVoted,
    isHost: computedValues.isHost,
    canVote: computedValues.canVote,
    currentUserData: computedValues.currentUserData,
  };
}
