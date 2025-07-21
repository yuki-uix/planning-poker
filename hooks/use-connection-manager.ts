import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionManager, ConnectionConfig, ConnectionState } from '@/lib/connection-manager';

export interface UseConnectionManagerConfig {
  sessionId: string;
  userId: string;
  pollingInterval?: number;
  heartbeatInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface UseConnectionManagerReturn {
  state: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  sendMessage: (message: any) => Promise<void>;
}

export function useConnectionManager(config: UseConnectionManagerConfig): UseConnectionManagerReturn {
  const [state, setState] = useState<ConnectionState>({
    isConnected: false,
    lastHeartbeat: 0,
    retryCount: 0,
    lastError: null,
    connectionType: 'polling'
  });

  const connectionManagerRef = useRef<ConnectionManager | null>(null);

  // 创建连接管理器
  useEffect(() => {
    const connectionConfig: ConnectionConfig = {
      sessionId: config.sessionId,
      userId: config.userId,
      pollingInterval: config.pollingInterval,
      heartbeatInterval: config.heartbeatInterval,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay
    };

    connectionManagerRef.current = new ConnectionManager(connectionConfig);

    // 清理函数
    return () => {
      if (connectionManagerRef.current) {
        connectionManagerRef.current.disconnect();
        connectionManagerRef.current = null;
      }
    };
  }, [config.sessionId, config.userId, config.pollingInterval, config.heartbeatInterval, config.maxRetries, config.retryDelay]);

  // 状态更新
  useEffect(() => {
    if (!connectionManagerRef.current) return;

    const updateState = () => {
      const currentState = connectionManagerRef.current?.getState();
      if (currentState) {
        setState(currentState);
      }
    };

    // 定期更新状态
    const interval = setInterval(updateState, 1000);
    updateState(); // 立即更新一次

    return () => clearInterval(interval);
  }, []);

  const connect = useCallback(async () => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }
  }, []);

  const reconnect = useCallback(async () => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.reconnect();
    }
  }, []);

  const sendMessage = useCallback(async (message: any) => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.sendMessage(message);
    }
  }, []);

  return {
    state,
    connect,
    disconnect,
    reconnect,
    sendMessage
  };
} 