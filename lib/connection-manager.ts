// 混合连接管理器
// 优先使用WebSocket，失败时自动降级到HTTP轮询
// 提供更稳定的连接体验

import { WebSocketClient, WebSocketMessage } from './websocket-client';
import { Session } from '@/types/estimation';

export interface ConnectionConfig {
  sessionId: string;
  userId: string;
  websocketUrl: string;
  httpPollInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  fallbackDelay?: number;
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: 'websocket' | 'http' | 'disconnected';
  lastHeartbeat: number;
  reconnectAttempts: number;
}

export class ConnectionManager {
  private config: ConnectionConfig;
  private wsClient: WebSocketClient | null = null;
  private httpPollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private state: ConnectionState;
  private isManualClose = false;

  // 事件回调
  private onSessionUpdateCallback: ((session: Session) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onErrorCallback: ((error: unknown) => void) | null = null;
  private onConnectionTypeChangeCallback: ((type: 'websocket' | 'http') => void) | null = null;

  constructor(config: ConnectionConfig) {
    this.config = {
      httpPollInterval: 2000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 10,
      fallbackDelay: 5000,
      ...config
    };

    this.state = {
      isConnected: false,
      isConnecting: false,
      connectionType: 'disconnected',
      lastHeartbeat: 0,
      reconnectAttempts: 0
    };
  }

  // 连接（优先WebSocket）
  async connect(): Promise<void> {
    if (this.state.isConnected || this.state.isConnecting) {
      return;
    }

    this.isManualClose = false;
    this.state.isConnecting = true;

    try {
      // 首先尝试WebSocket连接
      await this.connectWebSocket();
    } catch (error) {
      console.log('WebSocket connection failed, falling back to HTTP polling:', error);
      this.fallbackToHttp();
    }
  }

  // 连接WebSocket
  private async connectWebSocket(): Promise<void> {
    this.wsClient = new WebSocketClient({
      url: this.config.websocketUrl,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      reconnectInterval: 3000,
      heartbeatInterval: this.config.heartbeatInterval!,
      maxReconnectAttempts: this.config.maxReconnectAttempts!
    });

    // 设置WebSocket事件回调
    this.wsClient.onConnect(() => {
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.connectionType = 'websocket';
      this.state.reconnectAttempts = 0;
      this.startHeartbeat();
      this.onConnectCallback?.();
      this.onConnectionTypeChangeCallback?.('websocket');
    });

    this.wsClient.onDisconnect(() => {
      this.state.isConnected = false;
      this.state.connectionType = 'disconnected';
      this.stopHeartbeat();
      this.onDisconnectCallback?.();

      if (!this.isManualClose) {
        this.fallbackToHttp();
      }
    });

    this.wsClient.onError((error) => {
      console.error('WebSocket error:', error);
      this.onErrorCallback?.(error);
      
      if (!this.isManualClose) {
        this.fallbackToHttp();
      }
    });

    this.wsClient.onMessage((message: WebSocketMessage) => {
      this.handleMessage(message);
    });

    await this.wsClient.connect();
  }

  // 降级到HTTP轮询
  private fallbackToHttp(): void {
    if (this.state.connectionType === 'http') {
      return; // 已经在HTTP模式
    }

    console.log('Falling back to HTTP polling');
    this.state.connectionType = 'http';
    this.state.isConnected = true;
    this.state.isConnecting = false;
    this.onConnectionTypeChangeCallback?.('http');

    // 延迟启动HTTP轮询，避免立即重试
    setTimeout(() => {
      this.startHttpPolling();
    }, this.config.fallbackDelay);
  }

  // 启动HTTP轮询
  private startHttpPolling(): void {
    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
    }

    // 立即执行一次
    this.pollSession();

    // 设置轮询间隔
    this.httpPollTimer = setInterval(() => {
      this.pollSession();
    }, this.config.httpPollInterval);
  }

  // HTTP轮询获取会话数据
  private async pollSession(): Promise<void> {
    try {
      const response = await fetch(`/api/session/${this.config.sessionId}`);
      if (response.ok) {
        const session = await response.json();
        this.onSessionUpdateCallback?.(session);
        this.state.lastHeartbeat = Date.now();
      } else {
        throw new Error('Session not found');
      }
    } catch (error) {
      console.error('HTTP polling failed:', error);
      this.onErrorCallback?.(error);
      
      // 如果HTTP轮询也失败，尝试重新连接WebSocket
      if (this.state.reconnectAttempts < this.config.maxReconnectAttempts!) {
        this.state.reconnectAttempts++;
        setTimeout(() => {
          this.connectWebSocket().catch(() => {
            // WebSocket连接失败，继续HTTP轮询
          });
        }, 5000);
      }
    }
  }

  // 处理消息
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'session_update':
        if (message.data && this.onSessionUpdateCallback && typeof message.data === 'object' && 'id' in message.data) {
          this.onSessionUpdateCallback(message.data as Session);
        }
        break;
      case 'heartbeat_ack':
        this.state.lastHeartbeat = Date.now();
        break;
      default:
        console.log('Received message:', message);
    }
  }

  // 发送消息
  send(message: Omit<WebSocketMessage, 'timestamp'>): void {
    if (this.state.connectionType === 'websocket' && this.wsClient) {
      this.wsClient.send(message);
    } else if (this.state.connectionType === 'http') {
      // HTTP模式下，通过API发送消息
      this.sendViaHttp(message);
    } else {
      console.warn('No active connection, message not sent');
    }
  }

  // 通过HTTP发送消息
  private async sendViaHttp(message: Omit<WebSocketMessage, 'timestamp'>): Promise<void> {
    try {
      const response = await fetch('/api/session/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error('Failed to send message via HTTP');
      }
    } catch (error) {
      console.error('Failed to send message via HTTP:', error);
      this.onErrorCallback?.(error);
    }
  }

  // 开始心跳
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({
        type: 'heartbeat',
        sessionId: this.config.sessionId,
        userId: this.config.userId
      });
    }, this.config.heartbeatInterval);
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 断开连接
  disconnect(): void {
    this.isManualClose = true;
    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.connectionType = 'disconnected';

    this.stopHeartbeat();

    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
      this.httpPollTimer = null;
    }

    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
  }

  // 设置事件回调
  onSessionUpdate(callback: (session: Session) => void): void {
    this.onSessionUpdateCallback = callback;
  }

  onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  onError(callback: (error: unknown) => void): void {
    this.onErrorCallback = callback;
  }

  onConnectionTypeChange(callback: (type: 'websocket' | 'http') => void): void {
    this.onConnectionTypeChangeCallback = callback;
  }

  // 获取连接状态
  getState(): ConnectionState {
    return { ...this.state };
  }

  // 检查是否连接
  isConnected(): boolean {
    return this.state.isConnected;
  }

  // 获取连接类型
  getConnectionType(): 'websocket' | 'http' | 'disconnected' {
    return this.state.connectionType;
  }
} 