// 统一的连接管理器
// 简化版本，专注于稳定性

import { Session } from '@/types/estimation';

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: 'http' | 'disconnected';
  lastHeartbeat: number;
  reconnectAttempts: number;
}

export interface ConnectionConfig {
  sessionId: string;
  userId: string;
  pollUrl: string;
  pollInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  fallbackDelay?: number;
}

export interface ConnectionMessage {
  type: string;
  sessionId: string;
  userId: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export class ConnectionManager {
  private config: Required<ConnectionConfig>;
  private state: ConnectionState;
  private httpPollInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isManualClose = false;

  // 回调函数
  private onSessionUpdateCallback?: (session: Session) => void;
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onErrorCallback?: (error: Error | string) => void;
  private onConnectionTypeChangeCallback?: (type: 'http' | 'disconnected') => void;

  constructor(config: ConnectionConfig) {
    this.config = {
      pollInterval: 8000, // 8秒轮询间隔
      heartbeatInterval: 15000, // 15秒心跳间隔
      maxReconnectAttempts: 5,
      fallbackDelay: 3000,
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

  // 连接
  async connect(): Promise<void> {
    if (this.state.isConnected || this.state.isConnecting) {
      return;
    }

    this.state.isConnecting = true;
    this.isManualClose = false;

    try {
      await this.connectHttpPoll();
    } catch (error) {
      console.error('Failed to establish connection:', error);
      this.state.isConnecting = false;
      this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // 断开连接
  disconnect(): void {
    this.isManualClose = true;
    this.state.isConnected = false;
    this.state.isConnecting = false;

    // 停止HTTP轮询
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }

    // 停止心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.onDisconnectCallback?.();
  }

  // 获取状态
  getState(): ConnectionState {
    return { ...this.state };
  }

  // 发送消息
  async sendMessage(message: ConnectionMessage): Promise<void> {
    if (!this.state.isConnected) {
      console.warn('Cannot send message: not connected');
      return;
    }

    try {
      const response = await fetch(this.config.pollUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...message,
          sessionId: this.config.sessionId,
          userId: this.config.userId,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // 设置回调函数
  onSessionUpdate(callback: (session: Session) => void): void {
    this.onSessionUpdateCallback = callback;
  }

  onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  onError(callback: (error: Error | string) => void): void {
    this.onErrorCallback = callback;
  }

  onConnectionTypeChange(callback: (type: 'http' | 'disconnected') => void): void {
    this.onConnectionTypeChangeCallback = callback;
  }

  // HTTP轮询连接
  private async connectHttpPoll(): Promise<void> {
    console.log('Connecting via HTTP polling');
    
    // 立即执行一次轮询
    await this.pollSession();
    
    // 设置轮询间隔
    this.httpPollInterval = setInterval(() => {
      this.pollSession();
    }, this.config.pollInterval);

    // 设置心跳
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    this.state.isConnected = true;
    this.state.isConnecting = false;
    this.state.connectionType = 'http';
    this.state.reconnectAttempts = 0;
    
    this.onConnectCallback?.();
    this.onConnectionTypeChangeCallback?.('http');
  }

  // HTTP轮询获取会话数据
  private async pollSession(): Promise<void> {
    try {
      const response = await fetch(this.config.pollUrl);
      
      if (response.ok) {
        const session = await response.json();
        this.onSessionUpdateCallback?.(session);
        this.state.lastHeartbeat = Date.now();
        this.state.reconnectAttempts = 0; // 重置重连计数
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('HTTP polling failed:', error);
      
      this.state.reconnectAttempts++;
      
      if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
        this.state.isConnected = false;
        this.state.connectionType = 'disconnected';
        this.onDisconnectCallback?.();
        this.onConnectionTypeChangeCallback?.('disconnected');
      }
      
      this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // 发送心跳
  private async sendHeartbeat(): Promise<void> {
    try {
      await this.sendMessage({
        type: 'heartbeat',
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }
} 