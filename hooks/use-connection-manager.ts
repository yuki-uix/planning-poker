import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectionManager, ConnectionState, ConnectionConfig } from '@/lib/connection-manager';
import { Session } from '@/types/estimation';

export interface UseConnectionManagerOptions {
  sessionId: string;
  userId: string;
  onSessionUpdate?: (session: Session) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error | string) => void;
  onConnectionTypeChange?: (type: 'http' | 'disconnected') => void;
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

    const pollUrl = `/api/session/${sessionId}`;
    
    connectionManagerRef.current = new ConnectionManager({
      sessionId,
      userId,
      pollUrl,
      pollInterval: 8000, // 8秒轮询
      heartbeatInterval: 15000, // 15秒心跳
      maxReconnectAttempts: 5,
      fallbackDelay: 3000
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

    connectionManagerRef.current.onError((error: Error | string) => {
      console.error('Connection error:', error);
      onError?.(error);
    });

    connectionManagerRef.current.onConnectionTypeChange((type) => {
      setConnectionState(prev => ({ ...prev, connectionType: type }));
      onConnectionTypeChange?.(type);
    });
  }, [sessionId, userId, onSessionUpdate, onConnect, onDisconnect, onError, onConnectionTypeChange]);

  // 连接
  const connect = useCallback(async () => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.connect();
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (message: any) => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.sendMessage(message);
    }
  }, []);

  // 初始化
  useEffect(() => {
    if (sessionId && userId) {
      initConnectionManager();
    }

    return () => {
      if (connectionManagerRef.current) {
        connectionManagerRef.current.disconnect();
      }
    };
  }, [sessionId, userId, initConnectionManager]);

  return {
    connectionState,
    connect,
    disconnect,
    sendMessage,
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    connectionType: connectionState.connectionType
  };
} 