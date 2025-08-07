import { useEffect, useRef, useState, useCallback } from 'react';
import { ConnectionManager, ConnectionState } from '../lib/connection-manager';
import { WebSocketMessage } from '../lib/websocket-client';
import { Session } from '../types/estimation';

interface UseConnectionManagerOptions {
  sessionId: string;
  userId: string;
  onSessionUpdate?: (session: Session) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  onConnectionTypeChange?: (type: 'websocket' | 'http') => void;
}

export function useConnectionManager({
  sessionId,
  userId,
  onSessionUpdate,
  onConnect,
  onDisconnect,
  onError,
  onConnectionTypeChange
}: UseConnectionManagerOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    connectionType: 'disconnected',
    lastHeartbeat: 0,
    reconnectAttempts: 0
  });

  const connectionManagerRef = useRef<ConnectionManager | null>(null);

  // 初始化连接管理器
  const initConnectionManager = useCallback(() => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }

    const websocketUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/websocket?sessionId=${sessionId}&userId=${userId}`;
    
    connectionManagerRef.current = new ConnectionManager({
      sessionId,
      userId,
      websocketUrl,
      httpPollInterval: 2000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 10,
      fallbackDelay: 5000
    });

    // 设置事件回调
    connectionManagerRef.current.onSessionUpdate((session: Session) => {
      onSessionUpdate?.(session);
    });

    connectionManagerRef.current.onConnect(() => {
      console.log('Connection established');
      setConnectionState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
      onConnect?.();
    });

    connectionManagerRef.current.onDisconnect(() => {
      console.log('Connection lost');
      setConnectionState(prev => ({ ...prev, isConnected: false }));
      onDisconnect?.();
    });

    connectionManagerRef.current.onError((error: any) => {
      console.error('Connection error:', error);
      onError?.(error);
    });

    connectionManagerRef.current.onConnectionTypeChange((type: 'websocket' | 'http') => {
      console.log('Connection type changed to:', type);
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
  }, [sessionId, userId, onSessionUpdate, onConnect, onDisconnect, onError, onConnectionTypeChange]);

  // 连接
  const connect = useCallback(async () => {
    if (connectionManagerRef.current) {
      try {
        await connectionManagerRef.current.connect();
      } catch (error) {
        console.error('Failed to connect:', error);
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
  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.send(message);
    } else {
      console.warn('Connection manager not initialized');
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

  // 组件挂载时初始化连接管理器
  useEffect(() => {
    if (sessionId && userId) {
      const cleanup = initConnectionManager();
      return cleanup;
    }
  }, [sessionId, userId, initConnectionManager]);

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