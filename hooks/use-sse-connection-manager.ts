import { useEffect, useRef, useState, useCallback } from 'react';
import { SSEConnectionManager } from '@/lib/sse-connection-manager';
import { SSEMessage } from '@/lib/sse-client';
import { Session } from '@/types/estimation';

interface UseSSEConnectionManagerOptions {
  sessionId: string;
  userId: string;
  onSessionUpdate?: (session: Session) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
  onConnectionTypeChange?: (type: 'sse' | 'http') => void;
}

export interface SSEConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: 'sse' | 'http' | 'disconnected';
  lastHeartbeat: number;
  reconnectAttempts: number;
}

export function useSSEConnectionManager({
  sessionId,
  userId,
  onSessionUpdate,
  onConnect,
  onDisconnect,
  onError,
  onConnectionTypeChange
}: UseSSEConnectionManagerOptions) {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>({
    isConnected: false,
    isConnecting: false,
    connectionType: 'disconnected',
    lastHeartbeat: 0,
    reconnectAttempts: 0
  });

  const connectionManagerRef = useRef<SSEConnectionManager | null>(null);
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // 初始化连接管理器 - 使用 useRef 避免依赖项变化
  const initConnectionManager = useCallback(() => {
    // 避免重复初始化
    if (isInitializedRef.current && connectionManagerRef.current) {
      return;
    }

    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }

    const sseUrl = `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${window.location.host}/api/sse?sessionId=${sessionId}&userId=${userId}`;
    const pollUrl = `/api/session/${sessionId}`;
    
    connectionManagerRef.current = new SSEConnectionManager({
      sessionId,
      userId,
      sseUrl,
      pollUrl,
      pollInterval: 2000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 10,
      fallbackDelay: 5000
    });

    // 设置事件回调
    connectionManagerRef.current.onSessionUpdate((session: Session) => {
      onSessionUpdate?.(session);
    });

    connectionManagerRef.current.onConnect(() => {
      // 减少连接建立的日志输出频率
      if (Math.random() < 0.3) { // 只有30%的概率输出日志
        console.log('SSE connection established');
      }
      setConnectionState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
      onConnect?.();
    });

    connectionManagerRef.current.onDisconnect(() => {
      // 减少连接断开的日志输出频率
      if (Math.random() < 0.3) { // 只有30%的概率输出日志
        console.log('SSE connection lost');
      }
      setConnectionState(prev => ({ ...prev, isConnected: false }));
      onDisconnect?.();
    });

    connectionManagerRef.current.onError((error: any) => {
      console.error('SSE connection error:', error);
      onError?.(error);
    });

    connectionManagerRef.current.onConnectionTypeChange((type: 'sse' | 'http') => {
      // 减少连接类型变化的日志输出频率
      if (Math.random() < 0.2) { // 只有20%的概率输出日志
        console.log('SSE connection type changed to:', type);
      }
      setConnectionState(prev => ({ ...prev, connectionType: type }));
      onConnectionTypeChange?.(type);
    });

    // 定期更新连接状态（减少频率，避免频繁重新渲染）
    if (stateUpdateIntervalRef.current) {
      clearInterval(stateUpdateIntervalRef.current);
    }
    
    stateUpdateIntervalRef.current = setInterval(() => {
      if (connectionManagerRef.current) {
        setConnectionState(connectionManagerRef.current.getState());
      }
    }, 10000); // 改为10秒更新一次，减少频率

    isInitializedRef.current = true;
  }, [sessionId, userId]); // 只依赖 sessionId 和 userId

  // 连接
  const connect = useCallback(async () => {
    if (connectionManagerRef.current) {
      try {
        await connectionManagerRef.current.connect();
      } catch (error) {
        console.error('Failed to connect SSE:', error);
        throw error;
      }
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }
  }, []);

  // 发送消息
  const sendMessage = useCallback((message: Omit<SSEMessage, 'timestamp'>) => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.send(message);
    } else {
      console.warn('SSE connection manager not initialized');
    }
  }, []);

  // 发送投票
  const sendVote = useCallback((vote: string) => {
    sendMessage({
      type: 'vote',
      sessionId,
      userId,
      data: { vote }
    });
  }, [sendMessage, sessionId, userId]);

  // 发送显示投票请求
  const sendReveal = useCallback(() => {
    sendMessage({
      type: 'reveal',
      sessionId,
      userId
    });
  }, [sendMessage, sessionId, userId]);

  // 发送重置投票请求
  const sendReset = useCallback(() => {
    sendMessage({
      type: 'reset',
      sessionId,
      userId
    });
  }, [sendMessage, sessionId, userId]);

  // 发送模板更新
  const sendTemplateUpdate = useCallback((templateData: { type: string; customCards?: string }) => {
    sendMessage({
      type: 'template_update',
      sessionId,
      userId,
      data: templateData
    });
  }, [sendMessage, sessionId, userId]);

  // 组件挂载时初始化连接管理器并连接
  useEffect(() => {
    if (sessionId && userId && !isInitializedRef.current) {
      initConnectionManager();
      
      // 延迟连接，确保连接管理器已初始化
      const connectTimer = setTimeout(() => {
        if (connectionManagerRef.current) {
          connect();
        }
      }, 100);
      
      return () => {
        clearTimeout(connectTimer);
      };
    }
  }, [sessionId, userId, initConnectionManager, connect]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (stateUpdateIntervalRef.current) {
        clearInterval(stateUpdateIntervalRef.current);
      }
      if (connectionManagerRef.current) {
        connectionManagerRef.current.disconnect();
      }
      isInitializedRef.current = false;
    };
  }, []);

  return {
    // 连接状态
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    connectionType: connectionState.connectionType,
    lastHeartbeat: connectionState.lastHeartbeat,
    reconnectAttempts: connectionState.reconnectAttempts,

    // 连接管理
    connect,
    disconnect,

    // 消息发送
    sendMessage,
    sendVote,
    sendReveal,
    sendReset,
    sendTemplateUpdate
  };
} 