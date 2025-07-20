// 增强的混合连接管理器
// 集成自适应心跳、智能重连和连接质量监控
// 提供最稳定的连接体验

import { Session } from '@/types/estimation';
import { SSEConnectionManager } from './sse-connection-manager';
import { connectionDebugger } from './connection-debugger';
import { connectionStabilityMonitor } from './connection-stability-monitor';
import { adaptiveHeartbeatManager } from './adaptive-heartbeat-manager';
import { smartReconnectionManager } from './smart-reconnection-manager';
import { connectionQualityMonitor } from './connection-quality-monitor';

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
  enableAdaptiveFeatures?: boolean; // 启用自适应功能
  qualityMonitoring?: boolean; // 启用质量监控
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
      enableAdaptiveFeatures: true,
      qualityMonitoring: true,
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

  // 智能连接方法
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
      // 根据连接质量监控器选择最佳连接方式
      if (this.config.enableAdaptiveFeatures && this.config.qualityMonitoring) {
        await this.connectWithQualityOptimization();
      } else {
        // 使用传统连接方式
        if (this.config.preferredConnectionType === 'sse' || this.config.preferredConnectionType === 'auto') {
          await this.connectSSE();
        } else {
          await this.connectHttpPoll();
        }
      }
    } catch (error) {
      console.error('Failed to establish initial connection:', error);
      
      // 记录连接失败
      if (this.config.qualityMonitoring) {
        connectionQualityMonitor.recordMetrics(0, false);
      }
      
      // 智能降级
      if (this.config.preferredConnectionType === 'auto') {
        await this.intelligentFallback();
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

  // 开始自适应HTTP轮询
  private startHttpPolling(): void {
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
    }

    // 使用自适应心跳间隔
    const pollInterval = this.config.enableAdaptiveFeatures ? 
      adaptiveHeartbeatManager.getAdaptiveInterval() : 
      this.config.pollInterval;

    this.httpPollInterval = setInterval(async () => {
      const startTime = Date.now();
      
      try {
        // 使用自适应超时
        const timeout = this.config.enableAdaptiveFeatures ? 
          adaptiveHeartbeatManager.getAdaptiveTimeout() : 
          15000;

        const response = await fetch(this.config.pollUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(timeout)
        });

        if (response.ok) {
          const session = await response.json();
          
          // 验证会话数据
          if (session && session.id && session.users) {
            this.onSessionUpdateCallback?.(session);
            this.state.lastHeartbeat = Date.now();
            this.state.reconnectAttempts = 0; // 重置重连计数
            
            const responseTime = Date.now() - startTime;
            
            // 记录成功连接
            connectionStabilityMonitor.logSuccessfulConnection(
              this.config.sessionId,
              this.config.userId,
              'http'
            );

            // 记录质量指标
            if (this.config.qualityMonitoring) {
              connectionQualityMonitor.recordMetrics(responseTime, true);
            }

            // 记录自适应心跳结果
            if (this.config.enableAdaptiveFeatures) {
              adaptiveHeartbeatManager.recordHeartbeatResult(true, responseTime);
            }
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
        const responseTime = Date.now() - startTime;
        console.error('HTTP polling error:', error);
        
        // 记录质量指标
        if (this.config.qualityMonitoring) {
          connectionQualityMonitor.recordMetrics(responseTime, false);
        }

        // 记录自适应心跳结果
        if (this.config.enableAdaptiveFeatures) {
          adaptiveHeartbeatManager.recordHeartbeatResult(false, responseTime);
        }

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

        // 智能重连处理
        if (this.config.enableAdaptiveFeatures) {
          smartReconnectionManager.incrementAttemptCount();
          
          if (!smartReconnectionManager.shouldReconnect()) {
            this.disconnect();
            this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
          }
        } else {
          // 传统重连逻辑
          if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts! * 2) {
            this.disconnect();
            this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    }, pollInterval);
  }

  // 基于质量优化的连接方法
  private async connectWithQualityOptimization(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 获取建议的连接类型
      const recommendedType = connectionQualityMonitor.getRecommendedConnectionType();
      console.log(`Quality monitor recommends: ${recommendedType}`);
      
      // 根据建议选择连接方式
      switch (recommendedType) {
        case 'sse':
          await this.connectSSE();
          break;
        case 'websocket':
          // 暂时使用HTTP轮询，因为WebSocket未实现
          await this.connectHttpPoll();
          break;
        case 'http':
        default:
          await this.connectHttpPoll();
          break;
      }
      
      const responseTime = Date.now() - startTime;
      connectionQualityMonitor.recordMetrics(responseTime, true);
      smartReconnectionManager.recordReconnectionResult(true, responseTime, 0);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      connectionQualityMonitor.recordMetrics(responseTime, false);
      smartReconnectionManager.recordReconnectionResult(false, responseTime, 0);
      throw error;
    }
  }

  // 智能降级策略
  private async intelligentFallback(): Promise<void> {
    console.log('Starting intelligent fallback');
    
    const currentQuality = connectionQualityMonitor.getConnectionQuality();
    const reconnectionStats = smartReconnectionManager.getReconnectionStats();
    
    console.log(`Current quality: ${currentQuality.toFixed(2)}, reconnection attempts: ${reconnectionStats.attemptCount}`);
    
    if (currentQuality < 0.3 || reconnectionStats.attemptCount >= 5) {
      // 网络质量很差或重连次数过多，直接使用HTTP轮询
      console.log('Network quality poor, using HTTP polling directly');
      await this.connectHttpPoll();
    } else {
      // 尝试智能降级
      await this.fallbackToHttp();
    }
  }

  // 降级到HTTP轮询
  private async fallbackToHttp(): Promise<void> {
    console.log('Falling back to HTTP polling');
    
    // 停止SSE连接
    if (this.sseManager) {
      this.sseManager.disconnect();
      this.sseManager = null;
    }

    // 使用智能重连延迟
    const delay = this.config.enableAdaptiveFeatures ? 
      smartReconnectionManager.getReconnectionDelay() : 
      this.config.fallbackDelay;
    
    console.log(`Waiting ${delay}ms before HTTP fallback`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    if (!this.isManualClose) {
      await this.connectHttpPoll();
    }
  }
} 