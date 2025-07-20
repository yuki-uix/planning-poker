// 混合连接管理器
// 优先使用SSE，失败时自动降级到WebSocket，最后降级到HTTP轮询
// 提供最稳定的连接体验

import { Session } from '@/types/estimation';
import { SSEConnectionManager } from './sse-connection-manager';
import { connectionDebugger } from './connection-debugger';
import { connectionStabilityMonitor } from './connection-stability-monitor';

export interface HybridConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: 'sse' | 'http' | 'disconnected';
  lastHeartbeat: number;
  reconnectAttempts: number;
  preferredType: 'sse' | 'http' | 'auto';
}

export interface HybridConnectionConfig {
  sessionId: string;
  userId: string;
  sseUrl: string;
  pollUrl: string;
  preferredConnectionType?: 'sse' | 'http' | 'auto';
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

export class HybridConnectionManager {
  private config: Required<HybridConnectionConfig>;
  private state: HybridConnectionState;
  private sseManager: SSEConnectionManager | null = null;
  private httpPollInterval: NodeJS.Timeout | null = null;
  private isManualClose = false;

  // 回调函数
  private onSessionUpdateCallback?: (session: Session) => void;
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onErrorCallback?: (error: Error | string) => void;
  private onConnectionTypeChangeCallback?: (type: 'sse' | 'http' | 'disconnected') => void;

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
      preferredType: this.config.preferredConnectionType
    };
  }

  // 连接方法
  async connect(): Promise<void> {
    if (this.state.isConnected || this.state.isConnecting) {
      return;
    }

    this.state.isConnecting = true;
    this.isManualClose = false;

    // 记录调试信息
    connectionDebugger.logStateChange({
      connectionType: 'disconnected',
      isConnected: false,
      isConnecting: true,
      lastHeartbeat: this.state.lastHeartbeat,
      reconnectAttempts: this.state.reconnectAttempts
    });

    try {
      if (this.config.preferredConnectionType === 'sse' || this.config.preferredConnectionType === 'auto') {
        await this.connectSSE();
      } else {
        await this.connectHttpPoll();
      }
    } catch (error) {
      console.error('Failed to establish initial connection:', error);
      
      // 如果首选连接失败，尝试降级
      if (this.config.preferredConnectionType === 'auto') {
        await this.fallbackToHttp();
      } else {
        this.state.isConnecting = false;
        this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // 断开连接
  disconnect(): void {
    this.isManualClose = true;
    this.state.isConnected = false;
    this.state.isConnecting = false;

    // 停止SSE连接
    if (this.sseManager) {
      this.sseManager.disconnect();
      this.sseManager = null;
    }

    // 停止HTTP轮询
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }

    // 记录调试信息
    connectionDebugger.logStateChange({
      connectionType: 'disconnected',
      isConnected: false,
      isConnecting: false,
      lastHeartbeat: this.state.lastHeartbeat,
      reconnectAttempts: this.state.reconnectAttempts
    });

    this.onDisconnectCallback?.();
  }

  // 获取状态
  getState(): HybridConnectionState {
    return { ...this.state };
  }

  // 发送消息
  async sendMessage(message: ConnectionMessage): Promise<void> {
    if (!this.state.isConnected) {
      console.warn('Cannot send message: not connected');
      return;
    }

    try {
      // 在Vercel环境中，我们使用HTTP POST发送消息
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

  onConnectionTypeChange(callback: (type: 'sse' | 'http' | 'disconnected') => void): void {
    this.onConnectionTypeChangeCallback = callback;
  }

  // 私有方法

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
        this.fallbackToHttp();
      }
    });

    this.sseManager.onError((error: unknown) => {
      console.error('SSE error:', error);
      this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
      
      if (!this.isManualClose) {
        this.fallbackToHttp();
      }
    });

    this.sseManager.onConnectionTypeChange((type) => {
      this.state.connectionType = type;
      this.onConnectionTypeChangeCallback?.(type);
    });

    await this.sseManager.connect();
  }

  // 连接HTTP轮询
  private async connectHttpPoll(): Promise<void> {
    this.state.isConnected = true;
    this.state.isConnecting = false;
    this.state.connectionType = 'http';
    this.state.reconnectAttempts = 0;

    // 记录调试信息
    connectionDebugger.logStateChange({
      connectionType: 'http',
      isConnected: true,
      isConnecting: false,
      lastHeartbeat: this.state.lastHeartbeat,
      reconnectAttempts: this.state.reconnectAttempts
    });

    // 开始HTTP轮询
    this.startHttpPolling();

    this.onConnectCallback?.();
    this.onConnectionTypeChangeCallback?.('http');
  }

  // 开始HTTP轮询
  private startHttpPolling(): void {
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
    }

    this.httpPollInterval = setInterval(async () => {
      try {
        const response = await fetch(this.config.pollUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // 增加超时设置
          signal: AbortSignal.timeout(10000) // 10秒超时
        });

        if (response.ok) {
          const session = await response.json();
          
          // 验证会话数据
          if (session && session.id && session.users) {
            this.onSessionUpdateCallback?.(session);
            this.state.lastHeartbeat = Date.now();
            this.state.reconnectAttempts = 0; // 重置重连计数
          } else {
            throw new Error('Invalid session data received');
          }
        } else if (response.status === 404) {
          // 会话不存在，记录并通知
          console.error('Session not found:', this.config.sessionId);
          this.onErrorCallback?.(new Error('Session not found'));
          return;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('HTTP polling error:', error);
        this.state.reconnectAttempts++;
        
        // 记录调试信息
        connectionDebugger.logStateChange({
          connectionType: 'http',
          isConnected: false,
          isConnecting: false,
          lastHeartbeat: this.state.lastHeartbeat,
          reconnectAttempts: this.state.reconnectAttempts,
          error: error instanceof Error ? error.message : 'HTTP polling failed'
        });

        // 记录断开连接
        connectionStabilityMonitor.logDisconnection(
          error instanceof Error ? error.message : 'HTTP polling failed',
          'http',
          Date.now() - this.state.lastHeartbeat,
          this.config.sessionId,
          this.config.userId
        );

        if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts!) {
          this.disconnect();
          this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }, this.config.pollInterval);
  }

  // 降级到HTTP轮询
  private async fallbackToHttp(): Promise<void> {
    console.log('Falling back to HTTP polling');
    
    // 停止SSE连接
    if (this.sseManager) {
      this.sseManager.disconnect();
      this.sseManager = null;
    }

    // 等待一段时间后尝试HTTP轮询
    await new Promise(resolve => setTimeout(resolve, this.config.fallbackDelay));
    
    if (!this.isManualClose) {
      await this.connectHttpPoll();
    }
  }
} 