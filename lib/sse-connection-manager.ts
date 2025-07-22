// SSE连接管理器
// 提供与ConnectionManager相同的接口，实现SSE + HTTP轮询混合连接

import { SSEClient, SSEMessage } from './sse-client';
import { Session } from '@/types/estimation';
import { connectionStabilityMonitor } from './connection-stability-monitor';

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
      heartbeatInterval: 30000, // 增加到30秒
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
      // 在Render环境下，优先使用SSE
      await this.connectSSE();
    } catch (error) {
      console.log('SSE connection failed, falling back to HTTP polling:', error);
      
      // 记录连接失败
      connectionStabilityMonitor.logDisconnection(
        error instanceof Error ? error.message : 'SSE connection failed',
        'sse',
        0,
        this.config.sessionId,
        this.config.userId
      );
      
      this.fallbackToHttp();
    }
  }

  // 连接SSE
  private async connectSSE(): Promise<void> {
    this.sseClient = new SSEClient({
      sseUrl: this.config.sseUrl,
      pollUrl: this.config.pollUrl,
      pollInterval: this.config.pollInterval,
      reconnectInterval: 5000, // 增加重连间隔
      heartbeatInterval: this.config.heartbeatInterval!,
      maxReconnectAttempts: this.config.maxReconnectAttempts!
    });

    // 设置更长的超时时间
    this.sseClient.setTimeout(300000); // 5分钟

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
    
    // 启动HTTP轮询
    this.startHttpPolling();
  }
  
  // 启动HTTP轮询
  private startHttpPolling(): void {
    const pollInterval = setInterval(async () => {
      if (this.isManualClose) {
        clearInterval(pollInterval);
        return;
      }
      
      try {
        const response = await fetch(this.config.pollUrl);
        if (response.ok) {
          const sessionData = await response.json();
          if (sessionData.id && sessionData.users && this.onSessionUpdateCallback) {
            this.onSessionUpdateCallback(sessionData);
          }
          this.state.lastHeartbeat = Date.now();
          
          // 更新用户心跳
          await this.updateUserHeartbeat();
        } else {
          // 如果session不存在，继续轮询但不更新心跳
          // 减少日志输出频率，避免刷屏
          if (Math.random() < 0.1) { // 只有10%的概率输出日志
            console.log('Session not found during HTTP polling, continuing...');
          }
        }
      } catch (error) {
        console.error('HTTP polling error:', error);
        // 不要因为网络错误而断开连接
      }
    }, this.config.pollInterval);
    
    // 立即执行一次
    pollInterval.refresh();
  }
  
  // 更新用户心跳
  private async updateUserHeartbeat(): Promise<void> {
    try {
      await fetch(`/api/session/${this.config.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'heartbeat',
          userId: this.config.userId
        }),
      });
    } catch (error) {
      console.error('Failed to update heartbeat:', error);
    }
  }

  // 处理消息
  private handleMessage(message: SSEMessage): void {
    switch (message.type) {
      case 'session_update':
        if (message.data && this.onSessionUpdateCallback && typeof message.data === 'object' && 'id' in message.data) {
          // 安全地转换为Session类型
          const sessionData = message.data as unknown as Session;
          if (sessionData.id && sessionData.users) {
            this.onSessionUpdateCallback(sessionData);
          }
        }
        break;
      case 'heartbeat_ack':
        this.state.lastHeartbeat = Date.now();
        break;
      case 'session_not_found':
        console.log('Session not found in SSE, falling back to HTTP polling');
        this.fallbackToHttp();
        break;
      case 'session_expired':
        console.log('Session expired in SSE, falling back to HTTP polling');
        this.fallbackToHttp();
        break;
      default:
        // 减少日志输出频率，避免刷屏
        if (Math.random() < 0.05) { // 只有5%的概率输出日志
          console.log('Received message:', message);
        }
    }
  }

  // 发送消息
  send(message: Omit<SSEMessage, 'timestamp'>): void {
    if (this.sseClient) {
      this.sseClient.send(message);
    } else if (this.state.connectionType === 'http') {
      // HTTP模式下，通过API发送消息
      this.sendViaHttp(message);
    } else {
      console.warn('No active connection, message not sent');
    }
  }
  
  // 通过HTTP发送消息
  private async sendViaHttp(message: Omit<SSEMessage, 'timestamp'>): Promise<void> {
    try {
      const response = await fetch(`/api/session/${this.config.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: message.type,
          userId: this.config.userId,
          data: message.data
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message via HTTP');
      }
    } catch (error) {
      console.error('Failed to send message via HTTP:', error);
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