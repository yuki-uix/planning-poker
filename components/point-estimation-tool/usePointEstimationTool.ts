import { useCallback, useEffect } from "react";
import { Session, TemplateType } from "../../types/estimation";
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
      typeof import("../../lib/estimation-utils").calculateStats
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
    const userId = `${userState.userName}-${Date.now()}`;
    try {
      const result = await sessionActions.handleCreateSession(
        userState.userName,
        userId
      );
      if (result) {
        userState.setCurrentUser(userId);
        // 从 getUserData 获取 sessionId
        const userData = await import("../../lib/persistence").then((m) =>
          m.getUserData()
        );
        if (userData) {
          userState.setSessionId(userData.sessionId);
        }
        userState.setIsJoined(true);
        sessionState.setIsConnected(true);
      } else {
        sessionState.setIsConnected(false);
      }
    } catch {
      sessionState.setIsConnected(false);
    } finally {
      sessionState.setIsLoading(false);
    }
  }, [
    userState.userName,
    sessionState,
    sessionActions,
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
      await sessionActions.handleCastVote(
        userState.sessionId,
        userState.currentUser,
        vote,
        sessionState.session,
        computedValues.canVote
      );
    },
    [sessionState.session, userState, sessionActions, computedValues.canVote]
  );

  // 处理显示投票
  const handleRevealVotes = useCallback(async () => {
    if (!sessionState.session || !computedValues.isHost) return;
    await sessionActions.handleRevealVotes(
      userState.sessionId,
      userState.currentUser,
      sessionState.session,
      computedValues.isHost
    );
  }, [sessionState.session, userState, sessionActions, computedValues.isHost, sessionState.pollSession]);

  // 处理重置投票
  const handleResetVotes = useCallback(async () => {
    if (!sessionState.session || !computedValues.isHost) return;
    await sessionActions.handleResetVotes(
      userState.sessionId,
      userState.currentUser,
      sessionState.session,
      computedValues.isHost,
      userState.setSelectedVote,
      sessionState.pollSession
    );
  }, [sessionState.session, userState, sessionActions, computedValues.isHost, sessionState.pollSession]);

  // 处理模板变更
  const handleTemplateChange = useCallback(
    async (templateType: TemplateType) => {
      if (!sessionState.session || !computedValues.isHost) return;
      await sessionActions.handleTemplateChange(
        userState.sessionId,
        userState.currentUser,
        sessionState.session,
        computedValues.isHost,
        templateType,
        userState.setSelectedVote,
        sessionState.pollSession
      );
    },
    [sessionState.session, userState, sessionActions, computedValues.isHost, sessionState.pollSession]
  );

  // 处理自定义卡片变更
  const handleCustomCardsChange = useCallback(
    async (newCustomCards: string) => {
      if (!sessionState.session || !computedValues.isHost) return;
      await sessionActions.handleCustomCardsChange(
        userState.sessionId,
        userState.currentUser,
        sessionState.session,
        computedValues.isHost,
        newCustomCards,
        userState.setSelectedVote,
        sessionState.pollSession
      );
    },
    [sessionState.session, userState, sessionActions, computedValues.isHost, sessionState.pollSession]
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
  }, [userState, sessionState, sessionActions, uiState, computedValues.isHost]);

  // 处理返回主机
  const handleBackToHost = useCallback(() => {
    uiState.setShowSessionErrorModal(false);
    userState.clearUserState();
    sessionState.setSession(null);
    sessionState.setIsJoined(false);
    sessionState.setIsConnected(true);
    uiState.clearURL();
  }, [userState, sessionState, uiState]);

  const resultObj = {
    currentUser: userState.currentUser,
    userName: userState.userName,
    sessionId: userState.sessionId,
    selectedRole: userState.selectedRole,
    session: sessionState.session,
    selectedVote: userState.selectedVote,
    isJoined: sessionState.isJoined,
    isConnected: sessionState.isConnected,
    isLoading: sessionState.isLoading,
    copied: uiState.copied,
    isRestoring: userState.isRestoring,
    showSessionErrorModal: uiState.showSessionErrorModal,
    setUserName: userState.setUserName,
    setSelectedRole: userState.setSelectedRole,
    setShowSessionErrorModal: uiState.setShowSessionErrorModal,
    handleCreateSession,
    handleJoinSession,
    handleCastVote,
    handleRevealVotes,
    handleResetVotes,
    handleTemplateChange,
    handleCustomCardsChange,
    handleLogout,
    handleBackToHost,
    copyShareLink: uiState.copyShareLink,
    stats: computedValues.stats,
    allUsersVoted: computedValues.allUsersVoted,
    isHost: computedValues.isHost,
    canVote: computedValues.canVote,
    currentUserData: computedValues.currentUserData,
  };
  console.log("usePointEstimationTool", {
    session: sessionState.session,
    isJoined: sessionState.isJoined,
    isRestoring: userState.isRestoring,
    currentUser: userState.currentUser,
    sessionId: userState.sessionId,
  });
  return resultObj;
}
