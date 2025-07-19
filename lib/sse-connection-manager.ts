// SSE连接管理器
// 提供与ConnectionManager相同的接口，实现SSE + HTTP轮询混合连接

import { SSEClient, SSEMessage } from './sse-client';
import { Session } from '@/types/estimation';

export interface SSEConnectionConfig {
  sessionId: string;
  userId: string;
  sseUrl: string;
  pollUrl: string;
  pollInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  fallbackDelay?: number;
}

export interface SSEConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: 'sse' | 'http' | 'disconnected';
  lastHeartbeat: number;
  reconnectAttempts: number;
}

export class SSEConnectionManager {
  private config: SSEConnectionConfig;
  private sseClient: SSEClient | null = null;
  private state: SSEConnectionState;
  private isManualClose = false;

  // 事件回调
  private onSessionUpdateCallback: ((session: Session) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onErrorCallback: ((error: unknown) => void) | null = null;
  private onConnectionTypeChangeCallback: ((type: 'sse' | 'http') => void) | null = null;

  constructor(config: SSEConnectionConfig) {
    this.config = {
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
      reconnectAttempts: 0
    };
  }

  // 连接（优先SSE）
  async connect(): Promise<void> {
    if (this.state.isConnected || this.state.isConnecting) {
      return;
    }

    this.isManualClose = false;
    this.state.isConnecting = true;

    try {
      await this.connectSSE();
    } catch (error) {
      console.log('SSE connection failed, falling back to HTTP polling:', error);
      this.fallbackToHttp();
    }
  }

  // 连接SSE
  private async connectSSE(): Promise<void> {
    this.sseClient = new SSEClient({
      sseUrl: this.config.sseUrl,
      pollUrl: this.config.pollUrl,
      pollInterval: this.config.pollInterval,
      reconnectInterval: 3000,
      heartbeatInterval: this.config.heartbeatInterval!,
      maxReconnectAttempts: this.config.maxReconnectAttempts!
    });

    // 设置SSE事件回调
    this.sseClient.onConnect(() => {
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.connectionType = 'sse';
      this.state.reconnectAttempts = 0;
      this.onConnectCallback?.();
      this.onConnectionTypeChangeCallback?.('sse');
    });

    this.sseClient.onDisconnect(() => {
      this.state.isConnected = false;
      this.state.connectionType = 'disconnected';
      this.onDisconnectCallback?.();

      if (!this.isManualClose) {
        this.fallbackToHttp();
      }
    });

    this.sseClient.onError((error) => {
      console.error('SSE error:', error);
      this.onErrorCallback?.(error);
      
      if (!this.isManualClose) {
        this.fallbackToHttp();
      }
    });

    this.sseClient.onMessage((message: SSEMessage) => {
      this.handleMessage(message);
    });

    this.sseClient.onConnectionTypeChange((type) => {
      this.state.connectionType = type;
      this.onConnectionTypeChangeCallback?.(type);
    });

    await this.sseClient.connect();
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

  // 处理消息
  private handleMessage(message: SSEMessage): void {
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
  send(message: Omit<SSEMessage, 'timestamp'>): void {
    if (this.sseClient) {
      this.sseClient.send(message);
    } else {
      console.warn('No active connection, message not sent');
    }
  }

  // 断开连接
  disconnect(): void {
    this.isManualClose = true;
    
    if (this.sseClient) {
      this.sseClient.disconnect();
      this.sseClient = null;
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

  onConnectionTypeChange(callback: (type: 'sse' | 'http') => void): void {
    this.onConnectionTypeChangeCallback = callback;
  }

  // 获取状态
  getState(): SSEConnectionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }

  getConnectionType(): 'sse' | 'http' | 'disconnected' {
    return this.state.connectionType;
  }
} 