import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketClient, WebSocketMessage } from '@/lib/websocket-client';
import { Session } from '@/types/estimation';

interface UseWebSocketOptions {
  sessionId: string;
  userId: string;
  onSessionUpdate?: (session: Session) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({
  sessionId,
  userId,
  onSessionUpdate,
  onConnect,
  onDisconnect,
  onError
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsClientRef = useRef<WebSocketClient | null>(null);

  // 初始化WebSocket客户端
  const initWebSocket = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
    }

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/websocket?sessionId=${sessionId}&userId=${userId}`;
    
    wsClientRef.current = new WebSocketClient({
      url: wsUrl,
      sessionId,
      userId,
      reconnectInterval: 3000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 10
    });

    // 设置事件回调
    wsClientRef.current.onConnect(() => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setIsConnecting(false);
      onConnect?.();
    });

    wsClientRef.current.onDisconnect(() => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      onDisconnect?.();
    });

    wsClientRef.current.onError((error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setIsConnecting(false);
      onError?.(error);
    });

    wsClientRef.current.onMessage((message: WebSocketMessage) => {
      switch (message.type) {
        case 'session_update':
          if (message.data && onSessionUpdate && typeof message.data === 'object' && 'id' in message.data) {
            onSessionUpdate(message.data as Session);
          }
          break;
        case 'heartbeat_ack':
          // 心跳确认，可以用于连接质量监控
          break;
        default:
          console.log('Received message:', message);
      }
    });
  }, [sessionId, userId, onSessionUpdate, onConnect, onDisconnect, onError]);

  // 连接WebSocket
  const connect = useCallback(async () => {
    if (!wsClientRef.current) {
      initWebSocket();
    }

    if (wsClientRef.current && !isConnected && !isConnecting) {
      setIsConnecting(true);
      try {
        await wsClientRef.current.connect();
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setIsConnecting(false);
        throw error;
      }
    }
  }, [isConnected, isConnecting, initWebSocket]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // 发送消息
  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (wsClientRef.current && isConnected) {
      wsClientRef.current.send(message);
    } else {
      console.warn('WebSocket not connected, message not sent');
    }
  }, [isConnected]);

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

  // 组件挂载时连接
  useEffect(() => {
    if (sessionId && userId) {
      connect();
    }

    // 组件卸载时断开连接
    return () => {
      disconnect();
    };
  }, [sessionId, userId, connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    sendMessage,
    sendVote,
    sendReveal,
    sendReset,
    sendTemplateUpdate
  };
} 