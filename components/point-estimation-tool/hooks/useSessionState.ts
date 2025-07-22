import { useState, useCallback, useEffect, useRef } from "react";
import { Session } from "@/types/estimation";
import { useSSEConnectionManager } from "@/hooks/use-sse-connection-manager";
import { leaveSession, userHeartbeat } from "@/app/actions";

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
  const hasLeftSessionRef = useRef<boolean>(false);

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
    },
    onDisconnect: () => {
      // SSE连接断开时，不立即离开会话，而是继续使用HTTP轮询
      console.log('SSE disconnected, falling back to HTTP polling');
    },
    onError: (error) => {
      // SSE连接错误时，不立即离开会话
      console.error('SSE connection error:', error);
    }
  });

  // 处理用户离开会话
  const handleUserLeave = useCallback(async () => {
    if (sessionId && currentUser && isJoined && !hasLeftSessionRef.current) {
      hasLeftSessionRef.current = true;
      try {
        console.log('User leaving session due to page close/visibility change', {
          sessionId,
          userId: currentUser,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          platform: navigator.platform
        });
        await leaveSession(sessionId, currentUser);
      } catch (error) {
        console.error('Failed to leave session:', error);
      }
    }
  }, [sessionId, currentUser, isJoined]);

  // 标签页关闭检测 - 优化版本，更适合生产环境
  useEffect(() => {
    if (!isJoined || !sessionId || !currentUser) return;

    let leaveTimeout: NodeJS.Timeout | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let lastActivityTime = Date.now();
    let isPageVisible = true;

    // 更新最后活跃时间
    const updateActivity = () => {
      lastActivityTime = Date.now();
    };

    // 处理用户离开会话
    const handleUserLeave = async () => {
      if (sessionId && currentUser && isJoined && !hasLeftSessionRef.current) {
        hasLeftSessionRef.current = true;
        try {
          console.log('User leaving session due to page close/visibility change');
          await leaveSession(sessionId, currentUser);
        } catch (error) {
          console.error('Failed to leave session:', error);
        }
      }
    };

    // 心跳检测 - 确保用户仍然活跃
    const startHeartbeat = () => {
      heartbeatInterval = setInterval(async () => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityTime;
        
        // 如果页面可见且超过30秒没有活动，发送心跳
        if (isPageVisible && timeSinceLastActivity > 30000) {
          updateActivity();
          // 发送心跳请求到服务器
          try {
            console.log('Sending heartbeat to keep session alive');
            await userHeartbeat(sessionId, currentUser);
          } catch (error) {
            console.error('Failed to send heartbeat:', error);
          }
        }
      }, 30000); // 每30秒检查一次
    };

    const handleBeforeUnload = (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _event: BeforeUnloadEvent
    ) => {
      // 在页面卸载前尝试离开会话
      console.log('Page unloading, leaving session');
      handleUserLeave();
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      // 当页面隐藏时（包括关闭标签页、刷新等）
      console.log('Page hiding, persisted:', event.persisted);
      if (event.persisted === false) {
        // 页面不会保持状态，用户可能真的离开了
        handleUserLeave();
      }
    };

    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible;
      isPageVisible = document.visibilityState === 'visible';
      
      console.log('Visibility changed:', document.visibilityState);
      
      if (wasVisible && !isPageVisible) {
        // 页面变为不可见
        // 清除之前的定时器
        if (leaveTimeout) {
          clearTimeout(leaveTimeout);
        }
        
        // 延迟执行，给用户一些时间重新打开标签页
        // 在生产环境中使用更长的延迟
        const delay = process.env.NODE_ENV === 'production' ? 30000 : 10000; // 生产环境30秒，开发环境10秒
        leaveTimeout = setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            console.log('Page still hidden after delay, leaving session');
            handleUserLeave();
          }
        }, delay);
      } else if (!wasVisible && isPageVisible) {
        // 页面重新可见，清除定时器并更新活跃时间
        if (leaveTimeout) {
          clearTimeout(leaveTimeout);
          leaveTimeout = null;
        }
        updateActivity();
        console.log('Page became visible again, staying in session');
      }
    };

    // 监听用户活动
    const handleUserActivity = () => {
      updateActivity();
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 监听用户活动事件
    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    // 启动心跳检测
    startHeartbeat();

    // 初始化活跃时间
    updateActivity();

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      
      // 清理定时器
      if (leaveTimeout) {
        clearTimeout(leaveTimeout);
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }, [isJoined, sessionId, currentUser, handleUserLeave]);

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
