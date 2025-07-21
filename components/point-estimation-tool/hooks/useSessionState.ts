import { useState, useCallback, useEffect } from "react";
import { Session } from "@/types/estimation";
import { useConnectionManager } from "@/hooks/use-connection-manager";

export interface SessionState {
  session: Session | null;
  isJoined: boolean;
  isConnected: boolean;
  isLoading: boolean;
}

export interface SessionStateHandlers {
  setSession: (session: Session | null) => void;
  setIsJoined: (joined: boolean) => void;
  setIsConnected: (connected: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  pollSession: () => Promise<void>;
  sendHeartbeat: () => Promise<void>;
  // 新增的消息发送方法
  sendVote: (vote: string) => Promise<void>;
  sendReveal: () => Promise<void>;
  sendReset: () => Promise<void>;
  sendTemplateUpdate: (templateData: { type: string; customCards?: string }) => Promise<void>;
}

export function useSessionState(
  sessionId: string,
  currentUser: string,
  isJoined: boolean,
  isRestoring: boolean,
  setIsJoined: (joined: boolean) => void
): SessionState & SessionStateHandlers {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 使用统一的连接管理器
  const { 
    state, 
    connect, 
    disconnect, 
    sendMessage 
  } = useConnectionManager({
    sessionId,
    userId: currentUser
  });

  // 同步isJoined状态
  useEffect(() => {
    setIsJoined(isJoined);
  }, [isJoined, setIsJoined]);

  // 当用户加入时连接，离开时断开
  useEffect(() => {
    if (isJoined && !isRestoring && sessionId && currentUser) {
      connect();
    } else if (!isJoined) {
      disconnect();
    }
  }, [isJoined, isRestoring, sessionId, currentUser, connect, disconnect]);

  // 手动获取会话数据的函数
  const fetchSessionData = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
      } else {
        console.error('Failed to fetch session data:', response.status);
        setSession(null);
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
      setSession(null);
    }
  }, [sessionId]);

  // 当连接建立时，获取初始会话数据
  useEffect(() => {
    if (state.isConnected && sessionId && !session) {
      fetchSessionData();
    }
  }, [state.isConnected, sessionId, session, fetchSessionData]);

  // 定期轮询会话数据（作为备用机制）
  useEffect(() => {
    if (!isJoined || !sessionId || !state.isConnected) return;

    const pollInterval = setInterval(() => {
      fetchSessionData();
    }, 5000); // 每5秒轮询一次

    return () => clearInterval(pollInterval);
  }, [isJoined, sessionId, state.isConnected, fetchSessionData]);

  // 发送投票
  const sendVote = useCallback(async (vote: string) => {
    if (!sessionId || !currentUser) return;
    
    try {
      await sendMessage({
        type: 'vote',
        vote
      });
      // 投票后立即获取最新会话数据
      setTimeout(() => fetchSessionData(), 500);
    } catch (error) {
      console.error('Failed to send vote:', error);
    }
  }, [sessionId, currentUser, sendMessage, fetchSessionData]);

  // 发送显示投票请求
  const sendReveal = useCallback(async () => {
    if (!sessionId || !currentUser) return;
    
    try {
      await sendMessage({
        type: 'reveal'
      });
      // 显示投票后立即获取最新会话数据
      setTimeout(() => fetchSessionData(), 500);
    } catch (error) {
      console.error('Failed to send reveal:', error);
    }
  }, [sessionId, currentUser, sendMessage, fetchSessionData]);

  // 发送重置投票请求
  const sendReset = useCallback(async () => {
    if (!sessionId || !currentUser) return;
    
    try {
      await sendMessage({
        type: 'reset'
      });
      // 重置后立即获取最新会话数据
      setTimeout(() => fetchSessionData(), 500);
    } catch (error) {
      console.error('Failed to send reset:', error);
    }
  }, [sessionId, currentUser, sendMessage, fetchSessionData]);

  // 发送模板更新
  const sendTemplateUpdate = useCallback(async (templateData: { type: string; customCards?: string }) => {
    if (!sessionId || !currentUser) return;
    
    try {
      await sendMessage({
        type: 'template_update',
        templateType: templateData.type,
        customCards: templateData.customCards
      });
      // 模板更新后立即获取最新会话数据
      setTimeout(() => fetchSessionData(), 500);
    } catch (error) {
      console.error('Failed to send template update:', error);
    }
  }, [sessionId, currentUser, sendMessage, fetchSessionData]);

  // 兼容性方法 - 手动轮询
  const pollSession = useCallback(async () => {
    await fetchSessionData();
  }, [fetchSessionData]);

  const sendHeartbeat = useCallback(async () => {
    // 连接管理器会自动处理心跳
    console.log('Manual heartbeat not needed - handled by connection manager');
  }, []);

  return {
    session,
    isJoined,
    isConnected: state.isConnected,
    isLoading,
    setSession,
    setIsJoined,
    setIsConnected: () => {}, // 连接状态由连接管理器管理
    setIsLoading,
    pollSession,
    sendHeartbeat,
    // 新增的消息发送方法
    sendVote,
    sendReveal,
    sendReset,
    sendTemplateUpdate
  };
}
