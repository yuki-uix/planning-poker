import { useEffect, useRef, useState, useCallback } from 'react';
import { HybridConnectionManager, HybridConnectionState } from '@/lib/hybrid-connection-manager';
import { Session } from '@/types/estimation';

interface UseConnectionManagerOptions {
  sessionId: string;
  userId: string;
  preferredConnectionType?: 'sse' | 'http' | 'auto';
  onSessionUpdate?: (session: Session) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  onConnectionTypeChange?: (type: 'sse' | 'http' | 'disconnected') => void;
}

export function useConnectionManager({
  sessionId,
  userId,
  preferredConnectionType = 'auto',
  onSessionUpdate,
  onConnect,
  onDisconnect,
  onError,
  onConnectionTypeChange
}: UseConnectionManagerOptions) {
  const [connectionState, setConnectionState] = useState<HybridConnectionState>({
    isConnected: false,
    isConnecting: false,
    connectionType: 'disconnected',
    lastHeartbeat: 0,
    reconnectAttempts: 0,
    preferredType: preferredConnectionType
  });

  const connectionManagerRef = useRef<HybridConnectionManager | null>(null);

  // 初始化连接管理器
  const initConnectionManager = useCallback(() => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }

    const sseUrl = `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${window.location.host}/api/sse?sessionId=${sessionId}&userId=${userId}`;
    const pollUrl = `/api/session/${sessionId}`;
    
    connectionManagerRef.current = new HybridConnectionManager({
      sessionId,
      userId,
      sseUrl,
      pollUrl,
      preferredConnectionType,
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
      console.log('Hybrid connection established');
      setConnectionState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
      onConnect?.();
    });

    connectionManagerRef.current.onDisconnect(() => {
      console.log('Hybrid connection lost');
      setConnectionState(prev => ({ ...prev, isConnected: false }));
      onDisconnect?.();
    });

    connectionManagerRef.current.onError((error: any) => {
      console.error('Hybrid connection error:', error);
      onError?.(error);
    });

    connectionManagerRef.current.onConnectionTypeChange((type: 'sse' | 'http' | 'disconnected') => {
      console.log('Hybrid connection type changed to:', type);
      setConnectionState(prev => ({ ...prev, connectionType: type }));
      onConnectionTypeChange?.(type);
    });

    // 定期更新连接状态
    const stateUpdateInterval = setInterval(() => {
      if (connectionManagerRef.current) {
        setConnectionState(connectionManagerRef.current.getState());
      }
    }, 1000);

    return () => clearInterval(stateUpdateInterval);
  }, [sessionId, userId, preferredConnectionType, onSessionUpdate, onConnect, onDisconnect, onError, onConnectionTypeChange]);

  // 连接
  const connect = useCallback(async () => {
    if (connectionManagerRef.current) {
      try {
        await connectionManagerRef.current.connect();
      } catch (error) {
        console.error('Failed to connect hybrid:', error);
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
  const sendMessage = useCallback((message: any) => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.sendMessage(message);
    } else {
      console.warn('Hybrid connection manager not initialized');
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

  // 设置偏好连接类型
  const setPreferredConnectionType = useCallback((type: 'sse' | 'http' | 'auto') => {
    if (connectionManagerRef.current) {
      // 重新初始化连接管理器以应用新的偏好类型
      const cleanup = initConnectionManager();
      setConnectionState(prev => ({ ...prev, preferredType: type }));
      return cleanup;
    }
  }, [initConnectionManager]);

  // 组件挂载时初始化连接管理器
  useEffect(() => {
    if (sessionId && userId) {
      const cleanup = initConnectionManager();
      return cleanup;
    }
  }, [sessionId, userId, initConnectionManager]);

  // 页面可见性检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden, connection may be affected');
      } else {
        console.log('Page visible, checking connection status');
        // 页面重新可见时检查连接状态
        if (connectionManagerRef.current && !connectionState.isConnected) {
          connect().catch(console.error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connectionState.isConnected, connect]);

  // 组件挂载时连接
  useEffect(() => {
    if (sessionId && userId && connectionManagerRef.current) {
      connect();
    }

    // 组件卸载时断开连接
    return () => {
      disconnect();
    };
  }, [sessionId, userId, connect, disconnect]);

  return {
    // 连接状态
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    connectionType: connectionState.connectionType,
    lastHeartbeat: connectionState.lastHeartbeat,
    reconnectAttempts: connectionState.reconnectAttempts,
    preferredType: connectionState.preferredType,

    // 连接管理
    connect,
    disconnect,
    setPreferredConnectionType,

    // 消息发送
    sendMessage,
    sendVote,
    sendReveal,
    sendReset,
    sendTemplateUpdate
  };
} 