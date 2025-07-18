// WebSocket客户端管理器
// 提供稳定的实时连接，支持自动重连、心跳保活、消息队列等功能

import { Session } from '@/types/estimation';

export interface WebSocketMessage {
  type: 'vote' | 'reveal' | 'reset' | 'join' | 'leave' | 'heartbeat' | 'template_update' | 'session_update' | 'heartbeat_ack';
  sessionId: string;
  userId: string;
  data?: Record<string, unknown> | Session;
  timestamp: number;
  sequence?: number;
}

export interface WebSocketConfig {
  url: string;
  sessionId: string;
  userId: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  enableNetworkQualityDetection?: boolean;
}

export interface NetworkQuality {
  latency: number;
  packetLoss: number;
  connectionStability: number; // 0-1, 1表示最稳定
  lastUpdate: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnecting = false;
  private isManualClose = false;
  private networkQuality: NetworkQuality = {
    latency: 0,
    packetLoss: 0,
    connectionStability: 1,
    lastUpdate: Date.now()
  };
  private heartbeatResponses: Map<number, number> = new Map(); // sequence -> sendTime
  private lastHeartbeatSequence = 0;

  // 事件回调
  private onMessageCallback: ((message: WebSocketMessage) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Event) => void) | null = null;
  private onNetworkQualityChangeCallback: ((quality: NetworkQuality) => void) | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 2000, // 减少初始重连间隔
      heartbeatInterval: 15000, // 15秒心跳
      maxReconnectAttempts: 15, // 增加重连次数
      enableNetworkQualityDetection: true,
      ...config
    };
  }

  // 连接WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.isConnecting = true;
      this.isManualClose = false;

      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.onConnectCallback?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          this.onDisconnectCallback?.();

          if (!this.isManualClose && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.onErrorCallback?.(error);
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 处理接收到的消息
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'heartbeat_ack':
        this.handleHeartbeatAck(message);
        break;
      case 'session_update':
        // 更新连接稳定性
        this.updateConnectionStability(true);
        break;
      default:
        // 其他消息也更新连接稳定性
        this.updateConnectionStability(true);
    }

    this.onMessageCallback?.(message);
  }

  // 处理心跳确认
  private handleHeartbeatAck(message: WebSocketMessage): void {
    const sequence = message.sequence;
    if (sequence !== undefined) {
      const sendTime = this.heartbeatResponses.get(sequence);
      if (sendTime) {
        const latency = Date.now() - sendTime;
        this.updateNetworkQuality(latency, true);
        this.heartbeatResponses.delete(sequence);
      }
    }
  }

  // 更新网络质量
  private updateNetworkQuality(latency: number, success: boolean): void {
    const alpha = 0.3; // 平滑因子
    const now = Date.now();

    // 更新延迟
    this.networkQuality.latency = alpha * latency + (1 - alpha) * this.networkQuality.latency;

    // 更新丢包率
    if (success) {
      this.networkQuality.packetLoss = Math.max(0, this.networkQuality.packetLoss * 0.9);
    } else {
      this.networkQuality.packetLoss = Math.min(1, this.networkQuality.packetLoss + 0.1);
    }

    this.networkQuality.lastUpdate = now;
    this.onNetworkQualityChangeCallback?.(this.networkQuality);
  }

  // 更新连接稳定性
  private updateConnectionStability(success: boolean): void {
    const alpha = 0.1; // 缓慢调整
    if (success) {
      this.networkQuality.connectionStability = Math.min(1, this.networkQuality.connectionStability + alpha);
    } else {
      this.networkQuality.connectionStability = Math.max(0, this.networkQuality.connectionStability - alpha);
    }
  }

  // 断开连接
  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  // 发送消息
  send(message: Omit<WebSocketMessage, 'timestamp'>): void {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now()
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      // 如果连接断开，将消息加入队列
      this.messageQueue.push(fullMessage);
      console.log('Message queued, waiting for reconnection');
    }
  }

  // 发送心跳
  private sendHeartbeat(): void {
    const sequence = ++this.lastHeartbeatSequence;
    const sendTime = Date.now();
    
    this.heartbeatResponses.set(sequence, sendTime);
    
    this.send({
      type: 'heartbeat',
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      sequence
    });

    // 设置超时检查
    setTimeout(() => {
      if (this.heartbeatResponses.has(sequence)) {
        this.heartbeatResponses.delete(sequence);
        this.updateNetworkQuality(0, false); // 心跳超时
        this.updateConnectionStability(false);
      }
    }, 10000); // 10秒超时
  }

  // 开始心跳
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 安排重连
  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts++;
    
    // 智能重连策略
    let delay: number;
    
    if (this.networkQuality.connectionStability > 0.7) {
      // 网络稳定，使用较短延迟
      delay = Math.min(
        this.config.reconnectInterval! * Math.pow(1.5, this.reconnectAttempts - 1),
        15000 // 最大15秒
      );
    } else if (this.networkQuality.connectionStability > 0.3) {
      // 网络一般，使用中等延迟
      delay = Math.min(
        this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1),
        30000 // 最大30秒
      );
    } else {
      // 网络不稳定，使用较长延迟
      delay = Math.min(
        this.config.reconnectInterval! * Math.pow(3, this.reconnectAttempts - 1),
        60000 // 最大60秒
      );
    }

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms (stability: ${this.networkQuality.connectionStability.toFixed(2)})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnect failed:', error);
        this.updateConnectionStability(false);
      });
    }, delay);
  }

  // 清除重连定时器
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // 刷新消息队列
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws?.send(JSON.stringify(message));
      }
    }
  }

  // 设置事件回调
  onMessage(callback: (message: WebSocketMessage) => void): void {
    this.onMessageCallback = callback;
  }

  onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  onError(callback: (error: Event) => void): void {
    this.onErrorCallback = callback;
  }

  onNetworkQualityChange(callback: (quality: NetworkQuality) => void): void {
    this.onNetworkQualityChangeCallback = callback;
  }

  // 获取连接状态
  getState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 获取网络质量
  getNetworkQuality(): NetworkQuality {
    return { ...this.networkQuality };
  }

  // 获取重连统计
  getReconnectStats(): {
    attempts: number;
    maxAttempts: number;
    isManualClose: boolean;
  } {
    return {
      attempts: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts!,
      isManualClose: this.isManualClose
    };
  }
} 