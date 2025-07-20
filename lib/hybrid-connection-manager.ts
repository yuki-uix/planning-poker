// 混合连接管理器
// 优先使用SSE，失败时自动降级到WebSocket，最后降级到HTTP轮询
// 提供最稳定的连接体验

import { SSEConnectionManager } from './sse-connection-manager';
import { ConnectionManager } from './connection-manager';
import { Session } from '@/types/estimation';
import { connectionDebugger } from './connection-debugger';

export interface HybridConnectionConfig {
  sessionId: string;
  userId: string;
  sseUrl: string;
  websocketUrl: string;
  pollUrl: string;
  preferredConnectionType?: 'sse' | 'websocket' | 'auto';
  pollInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  fallbackDelay?: number;
}

export interface HybridConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: 'sse' | 'websocket' | 'http' | 'disconnected';
  lastHeartbeat: number;
  reconnectAttempts: number;
  preferredType: 'sse' | 'websocket' | 'auto';
}

export class HybridConnectionManager {
  private config: HybridConnectionConfig;
  private sseManager: SSEConnectionManager | null = null;
  private wsManager: ConnectionManager | null = null;
  private state: HybridConnectionState;
  private isManualClose = false;

  // 事件回调
  private onSessionUpdateCallback: ((session: Session) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onErrorCallback: ((error: unknown) => void) | null = null;
  private onConnectionTypeChangeCallback: ((type: 'sse' | 'websocket' | 'http') => void) | null = null;

  constructor(config: HybridConnectionConfig) {
    this.config = {
      preferredConnectionType: 'auto',
      pollInterval: 2000,
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
      reconnectAttempts: 0,
      preferredType: this.config.preferredConnectionType!
    };
  }

  // 连接（智能选择最佳连接方式）
  async connect(): Promise<void> {
    if (this.state.isConnected || this.state.isConnecting) {
      return;
    }

    this.isManualClose = false;
    this.state.isConnecting = true;

    // 根据偏好选择连接方式
    if (this.state.preferredType === 'sse' || this.state.preferredType === 'auto') {
      try {
        await this.connectSSE();
        return;
      } catch (error) {
        console.log('SSE connection failed, trying WebSocket:', error);
      }
    }

    if (this.state.preferredType === 'websocket' || this.state.preferredType === 'auto') {
      try {
        await this.connectWebSocket();
        return;
      } catch (error) {
        console.log('WebSocket connection failed, falling back to HTTP polling:', error);
      }
    }

    // 如果都失败了，使用HTTP轮询
    this.fallbackToHttp();
  }

  // 连接SSE
  private async connectSSE(): Promise<void> {
    this.sseManager = new SSEConnectionManager({
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      sseUrl: this.config.sseUrl,
      pollUrl: this.config.pollUrl,
      pollInterval: this.config.pollInterval,
      heartbeatInterval: this.config.heartbeatInterval!,
      maxReconnectAttempts: this.config.maxReconnectAttempts!,
      fallbackDelay: this.config.fallbackDelay
    });

    // 设置SSE事件回调
    this.sseManager.onSessionUpdate((session: Session) => {
      this.onSessionUpdateCallback?.(session);
    });

    this.sseManager.onConnect(() => {
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.connectionType = 'sse';
      this.state.reconnectAttempts = 0;
      
      // 记录调试信息
      connectionDebugger.logStateChange({
        connectionType: 'sse',
        isConnected: true,
        isConnecting: false,
        lastHeartbeat: this.state.lastHeartbeat,
        reconnectAttempts: this.state.reconnectAttempts
      });
      
      this.onConnectCallback?.();
      this.onConnectionTypeChangeCallback?.('sse');
    });

    this.sseManager.onDisconnect(() => {
      this.state.isConnected = false;
      this.state.connectionType = 'disconnected';
      
      // 记录调试信息
      connectionDebugger.logStateChange({
        connectionType: 'disconnected',
        isConnected: false,
        isConnecting: false,
        lastHeartbeat: this.state.lastHeartbeat,
        reconnectAttempts: this.state.reconnectAttempts,
        error: 'SSE connection lost'
      });
      
      this.onDisconnectCallback?.();

      if (!this.isManualClose) {
        this.tryWebSocketFallback();
      }
    });

    this.sseManager.onError((error) => {
      console.error('SSE error:', error);
      this.onErrorCallback?.(error);
      
      if (!this.isManualClose) {
        this.tryWebSocketFallback();
      }
    });

    this.sseManager.onConnectionTypeChange((type) => {
      this.state.connectionType = type;
      this.onConnectionTypeChangeCallback?.(type);
    });

    await this.sseManager.connect();
  }

  // 连接WebSocket
  private async connectWebSocket(): Promise<void> {
    this.wsManager = new ConnectionManager({
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      websocketUrl: this.config.websocketUrl,
      httpPollInterval: this.config.pollInterval,
      heartbeatInterval: this.config.heartbeatInterval!,
      maxReconnectAttempts: this.config.maxReconnectAttempts!,
      fallbackDelay: this.config.fallbackDelay
    });

    // 设置WebSocket事件回调
    this.wsManager.onSessionUpdate((session: Session) => {
      this.onSessionUpdateCallback?.(session);
    });

    this.wsManager.onConnect(() => {
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.connectionType = 'websocket';
      this.state.reconnectAttempts = 0;
      this.onConnectCallback?.();
      this.onConnectionTypeChangeCallback?.('websocket');
    });

    this.wsManager.onDisconnect(() => {
      this.state.isConnected = false;
      this.state.connectionType = 'disconnected';
      this.onDisconnectCallback?.();

      if (!this.isManualClose) {
        this.fallbackToHttp();
      }
    });

    this.wsManager.onError((error) => {
      console.error('WebSocket error:', error);
      this.onErrorCallback?.(error);
      
      if (!this.isManualClose) {
        this.fallbackToHttp();
      }
    });

    this.wsManager.onConnectionTypeChange((type) => {
      this.state.connectionType = type;
      this.onConnectionTypeChangeCallback?.(type);
    });

    await this.wsManager.connect();
  }

  // 尝试WebSocket降级
  private async tryWebSocketFallback(): Promise<void> {
    if (this.state.preferredType === 'sse') {
      // 如果偏好SSE，直接降级到HTTP
      this.fallbackToHttp();
      return;
    }

    try {
      await this.connectWebSocket();
    } catch (error) {
      console.log('WebSocket fallback failed, using HTTP polling:', error);
      this.fallbackToHttp();
    }
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
  }

  // 发送消息
  send(message: Record<string, unknown>): void {
    if (this.state.connectionType === 'sse' && this.sseManager) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.sseManager.send(message as any);
    } else if (this.state.connectionType === 'websocket' && this.wsManager) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.wsManager.send(message as any);
    } else if (this.state.connectionType === 'http') {
      // HTTP模式下，通过API发送消息
      this.sendViaHttp(message);
    } else {
      console.warn('No active connection, message not sent');
    }
  }

  // 通过HTTP发送消息
  private async sendViaHttp(message: Record<string, unknown>): Promise<void> {
    try {
      const response = await fetch('/api/session/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...message,
          timestamp: Date.now()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message via HTTP');
      }
    } catch (error) {
      console.error('Failed to send message via HTTP:', error);
      this.onErrorCallback?.(error);
    }
  }

  // 断开连接
  disconnect(): void {
    this.isManualClose = true;
    
    if (this.sseManager) {
      this.sseManager.disconnect();
      this.sseManager = null;
    }

    if (this.wsManager) {
      this.wsManager.disconnect();
      this.wsManager = null;
    }

    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.connectionType = 'disconnected';
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

  onConnectionTypeChange(callback: (type: 'sse' | 'websocket' | 'http') => void): void {
    this.onConnectionTypeChangeCallback = callback;
  }

  // 获取状态
  getState(): HybridConnectionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }

  getConnectionType(): 'sse' | 'websocket' | 'http' | 'disconnected' {
    return this.state.connectionType;
  }

  // 设置偏好连接类型
  setPreferredConnectionType(type: 'sse' | 'websocket' | 'auto'): void {
    this.state.preferredType = type;
  }
} 