// SSE客户端管理器
// 提供Server-Sent Events连接，失败时自动降级到HTTP轮询
// 确保连接的稳定性和可靠性

export interface SSEMessage {
  type: 'session_update' | 'heartbeat_ack' | 'user_joined' | 'user_left' | 'vote_received' | 'heartbeat' | 'vote' | 'reveal' | 'reset' | 'template_update' | 'session_not_found' | 'session_expired' | 'connected' | 'error';
  sessionId: string;
  userId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface SSEConfig {
  sseUrl: string;
  pollUrl: string;
  pollInterval?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface SSEState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: 'sse' | 'http' | 'disconnected';
  lastHeartbeat: number;
  reconnectAttempts: number;
}

export class SSEClient {
  private config: SSEConfig;
  private eventSource: EventSource | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private state: SSEState;
  private isManualClose = false;

  // 事件回调
  private onMessageCallback: ((message: SSEMessage) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onErrorCallback: ((error: unknown) => void) | null = null;
  private onConnectionTypeChangeCallback: ((type: 'sse' | 'http') => void) | null = null;

  constructor(config: SSEConfig) {
    this.config = {
      pollInterval: 3000,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
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

  // 设置超时时间
  setTimeout(timeout: number): void {
    // 这个方法用于设置连接超时时间
    // 在SSE中，超时主要通过EventSource的内置机制处理
    // 减少日志输出频率
    if (Math.random() < 0.1) { // 只有10%的概率输出日志
      console.log(`SSE timeout set to ${timeout}ms`);
    }
  }

  // 连接SSE
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
    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource(this.config.sseUrl);

        this.eventSource.onopen = () => {
          // 减少连接成功的日志输出频率
          if (Math.random() < 0.3) { // 只有30%的概率输出日志
            console.log('SSE connected');
          }
          this.state.isConnected = true;
          this.state.isConnecting = false;
          this.state.connectionType = 'sse';
          this.state.reconnectAttempts = 0;
          this.startHeartbeat();
          this.onConnectCallback?.();
          this.onConnectionTypeChangeCallback?.('sse');
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message: SSEMessage = JSON.parse(event.data);
            
            // 处理特殊消息类型
            if (message.type === 'session_not_found') {
              // 减少特殊消息的日志输出频率
              if (Math.random() < 0.2) { // 只有20%的概率输出日志
                console.log('Session not found, falling back to HTTP polling');
              }
              this.fallbackToHttp();
              return;
            }
            
            this.onMessageCallback?.(message);
          } catch (error) {
            console.error('Failed to parse SSE message:', error);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          this.state.isConnected = false;
          this.state.connectionType = 'disconnected';
          this.stopHeartbeat();
          this.onErrorCallback?.(error);
          this.onDisconnectCallback?.();

          if (!this.isManualClose) {
            this.fallbackToHttp();
          }
          reject(error);
        };

      } catch (error) {
        this.state.isConnecting = false;
        reject(error);
      }
    });
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
      this.startPolling();
    }, 1000);
  }

  // 启动HTTP轮询
  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    // 立即执行一次
    this.pollSession();

    // 设置轮询间隔
    this.pollTimer = setInterval(() => {
      this.pollSession();
    }, this.config.pollInterval);
  }

  // HTTP轮询获取会话数据
  private async pollSession(): Promise<void> {
    try {
      const response = await fetch(this.config.pollUrl);
      if (response.ok) {
        const sessionData = await response.json();
        // session API直接返回session数据，需要包装成SSE消息格式
        if (sessionData.id && sessionData.users) {
          const message: SSEMessage = {
            type: 'session_update',
            sessionId: sessionData.id,
            data: sessionData,
            timestamp: Date.now()
          };
          this.onMessageCallback?.(message);
        }
        this.state.lastHeartbeat = Date.now();
      } else {
        // 如果session不存在，不要立即断开连接，继续轮询
        // 减少日志输出频率，避免刷屏
        if (Math.random() < 0.1) { // 只有10%的概率输出日志
          console.log('Session not found during polling, continuing...');
        }
        this.state.lastHeartbeat = Date.now();
      }
    } catch (error) {
      console.error('HTTP polling failed:', error);
      this.onErrorCallback?.(error);
      
      // HTTP轮询失败时，不要尝试重新连接SSE，避免无限循环
      // 继续HTTP轮询，等待下次轮询
    }
  }

  // 发送消息
  send(message: Omit<SSEMessage, 'timestamp'>): void {
    if (this.state.connectionType === 'sse') {
      // SSE模式下，通过HTTP API发送消息
      this.sendViaHttp(message);
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
      // 从pollUrl中提取sessionId
      const sessionId = this.config.pollUrl.split('/').pop();
      if (!sessionId) {
        throw new Error('Cannot extract sessionId from pollUrl');
      }
      
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: message.type,
          userId: message.userId,
          data: message.data
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

  // 开始心跳
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      // 从SSE URL中提取sessionId
      const url = new URL(this.config.sseUrl);
      const sessionId = url.searchParams.get('sessionId') || '';
      
      this.send({
        type: 'heartbeat',
        sessionId,
        userId: url.searchParams.get('userId') || ''
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
    this.stopHeartbeat();
    this.stopPolling();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.connectionType = 'disconnected';
  }

  // 停止轮询
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // 设置事件回调
  onMessage(callback: (message: SSEMessage) => void): void {
    this.onMessageCallback = callback;
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
  getState(): SSEState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }

  getConnectionType(): 'sse' | 'http' | 'disconnected' {
    return this.state.connectionType;
  }
} 