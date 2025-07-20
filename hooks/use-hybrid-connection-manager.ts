import { useState, useRef, useCallback, useEffect } from 'react';
import { HybridConnectionManager, HybridConnectionState } from '@/lib/hybrid-connection-manager';
import { Session } from '@/types/estimation';

export interface UseHybridConnectionManagerOptions {
  sessionId: string;
  userId: string;
  preferredConnectionType?: 'sse' | 'http' | 'auto';
  onSessionUpdate?: (session: Session) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  onConnectionTypeChange?: (type: 'sse' | 'http' | 'disconnected') => void;
}

export function useHybridConnectionManager({
  sessionId,
  userId,
  preferredConnectionType = 'auto',
  onSessionUpdate,
  onConnect,
  onDisconnect,
  onError,
  onConnectionTypeChange
}: UseHybridConnectionManagerOptions) {
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

    connectionManagerRef.current.onConnectionTypeChange((type) => {
      console.log('Connection type changed:', type);
      setConnectionState(prev => ({ ...prev, connectionType: type }));
      onConnectionTypeChange?.(type);
    });
  }, [sessionId, userId, preferredConnectionType, onSessionUpdate, onConnect, onDisconnect, onError, onConnectionTypeChange]);

  // 连接方法
  const connect = useCallback(async () => {
    if (!connectionManagerRef.current) {
      initConnectionManager();
    }
    
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.connect();
    }
  }, [initConnectionManager]);

  // 断开连接方法
  const disconnect = useCallback(() => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }
  }, []);

  // 发送消息方法
  const sendMessage = useCallback(async (message: any) => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.sendMessage(message);
    }
  }, []);

  // 获取状态方法
  const getState = useCallback(() => {
    if (connectionManagerRef.current) {
      return connectionManagerRef.current.getState();
    }
    return connectionState;
  }, [connectionState]);

  // 组件挂载时初始化连接管理器
  useEffect(() => {
    initConnectionManager();
  }, [initConnectionManager]);

  // 组件卸载时清理连接
  useEffect(() => {
    return () => {
      if (connectionManagerRef.current) {
        connectionManagerRef.current.disconnect();
      }
    };
  }, []);

  return {
    connectionState,
    connect,
    disconnect,
    sendMessage,
    getState,
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    connectionType: connectionState.connectionType
  };
} 