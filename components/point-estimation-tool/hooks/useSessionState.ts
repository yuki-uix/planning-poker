import { useState, useCallback, useEffect, useRef } from "react";
import { Session } from "@/types/estimation";
import { useSSEConnectionManager } from "@/hooks/use-sse-connection-manager";

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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // 使用SSE连接管理器
  const { 
    isConnected,
    connect, 
    disconnect, 
    sendVote: sseSendVote,
    sendReveal: sseSendReveal,
    sendReset: sseSendReset,
    sendTemplateUpdate: sseSendTemplateUpdate
  } = useSSEConnectionManager({
    sessionId,
    userId: currentUser,
    onSessionUpdate: (session: Session) => {
      setSession(session);
    }
  });

  // 手动获取会话数据的函数
  const fetchSessionData = useCallback(async () => {
    if (!sessionId) return;
    
    // 防止频繁请求
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) {
      return;
    }
    lastFetchTimeRef.current = now;
    
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

  // 当用户加入时连接，离开时断开
  useEffect(() => {
    if (isJoined && !isRestoring && sessionId && currentUser) {
      // 延迟连接，确保session已经创建
      const timer = setTimeout(() => {
        connect();
      }, 2000); // 增加延迟时间
      return () => clearTimeout(timer);
    } else if (!isJoined) {
      disconnect();
    }
  }, [isJoined, isRestoring, sessionId, currentUser, connect, disconnect]);

  // 当连接建立时，获取初始会话数据
  useEffect(() => {
    if (isConnected && sessionId && !session) {
      fetchSessionData();
    }
  }, [isConnected, sessionId, session, fetchSessionData]);

  // 定期轮询会话数据（作为备用机制）- 优化频率
  useEffect(() => {
    if (!isJoined || !sessionId || !isConnected) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    // 清除之前的轮询
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      fetchSessionData();
    }, 10000); // 改为10秒轮询一次，减少频率

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isJoined, sessionId, isConnected, fetchSessionData]);

  // 发送投票
  const sendVote = useCallback(async (vote: string) => {
    if (!sessionId || !currentUser) return;
    
    try {
      sseSendVote(vote);
      // 投票后延迟获取最新会话数据
      setTimeout(() => fetchSessionData(), 1000);
    } catch (error) {
      console.error('Failed to send vote:', error);
    }
  }, [sessionId, currentUser, sseSendVote, fetchSessionData]);

  // 发送显示投票请求
  const sendReveal = useCallback(async () => {
    if (!sessionId || !currentUser) return;
    
    try {
      sseSendReveal();
      // 显示投票后延迟获取最新会话数据
      setTimeout(() => fetchSessionData(), 1000);
    } catch (error) {
      console.error('Failed to send reveal:', error);
    }
  }, [sessionId, currentUser, sseSendReveal, fetchSessionData]);

  // 发送重置投票请求
  const sendReset = useCallback(async () => {
    if (!sessionId || !currentUser) return;
    
    try {
      sseSendReset();
      // 重置后延迟获取最新会话数据
      setTimeout(() => fetchSessionData(), 1000);
    } catch (error) {
      console.error('Failed to send reset:', error);
    }
  }, [sessionId, currentUser, sseSendReset, fetchSessionData]);

  // 发送模板更新
  const sendTemplateUpdate = useCallback(async (templateData: { type: string; customCards?: string }) => {
    if (!sessionId || !currentUser) return;
    
    try {
      sseSendTemplateUpdate(templateData);
      // 模板更新后延迟获取最新会话数据
      setTimeout(() => fetchSessionData(), 1000);
    } catch (error) {
      console.error('Failed to send template update:', error);
    }
  }, [sessionId, currentUser, sseSendTemplateUpdate, fetchSessionData]);

  // 兼容性方法 - 手动轮询
  const pollSession = useCallback(async () => {
    await fetchSessionData();
  }, [fetchSessionData]);

  const sendHeartbeat = useCallback(async () => {
    // 连接管理器会自动处理心跳
    console.log('Manual heartbeat not needed - handled by connection manager');
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    session,
    isJoined,
    isConnected,
    isLoading,
    setSession,
    setIsJoined,
    setIsConnected: () => {}, // 连接状态由连接管理器管理
    setIsLoading,
    pollSession,
    sendHeartbeat,
    sendVote,
    sendReveal,
    sendReset,
    sendTemplateUpdate,
  };
}
