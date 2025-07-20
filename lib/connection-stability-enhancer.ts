// 连接稳定性增强器
// 提供更稳定的连接管理和自动恢复机制

import { connectionStabilityMonitor } from './connection-stability-monitor';
import { connectionDebugger } from './connection-debugger';

export interface ConnectionHealth {
  isHealthy: boolean;
  lastSuccessfulConnection: number;
  consecutiveFailures: number;
  averageResponseTime: number;
  connectionType: string;
}

export interface StabilityConfig {
  maxConsecutiveFailures?: number;
  healthCheckInterval?: number;
  recoveryDelay?: number;
  sessionId: string;
  userId: string;
}

export class ConnectionStabilityEnhancer {
  private config: Required<StabilityConfig>;
  private health: ConnectionHealth;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isRecovering = false;

  constructor(config: StabilityConfig) {
    this.config = {
      maxConsecutiveFailures: 5,
      healthCheckInterval: 30000, // 30秒健康检查
      recoveryDelay: 5000,
      ...config
    };

    this.health = {
      isHealthy: true,
      lastSuccessfulConnection: Date.now(),
      consecutiveFailures: 0,
      averageResponseTime: 0,
      connectionType: 'unknown'
    };
  }

  // 记录连接成功
  recordSuccess(connectionType: string, responseTime: number): void {
    this.health.isHealthy = true;
    this.health.lastSuccessfulConnection = Date.now();
    this.health.consecutiveFailures = 0;
    this.health.connectionType = connectionType;
    
    // 更新平均响应时间
    this.health.averageResponseTime = 
      (this.health.averageResponseTime + responseTime) / 2;

    connectionStabilityMonitor.logSuccessfulConnection(
      this.config.sessionId,
      this.config.userId,
      connectionType
    );

    console.log(`Connection healthy: ${connectionType}, response time: ${responseTime}ms`);
  }

  // 记录连接失败
  recordFailure(reason: string, connectionType: string): void {
    this.health.consecutiveFailures++;
    this.health.connectionType = connectionType;

    // 记录断开连接
    connectionStabilityMonitor.logDisconnection(
      reason,
      connectionType,
      Date.now() - this.health.lastSuccessfulConnection,
      this.config.sessionId,
      this.config.userId
    );

    // 检查是否需要标记为不健康
    if (this.health.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.health.isHealthy = false;
      console.warn(`Connection marked as unhealthy after ${this.health.consecutiveFailures} consecutive failures`);
    }

    console.error(`Connection failure: ${reason} (${connectionType}), consecutive failures: ${this.health.consecutiveFailures}`);
  }

  // 开始健康检查
  startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  // 停止健康检查
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // 执行健康检查
  private async performHealthCheck(): Promise<void> {
    if (this.isRecovering) return;

    const startTime = Date.now();
    try {
      // 简单的健康检查请求
      const response = await fetch(`/api/session/${this.config.sessionId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        this.recordSuccess('health_check', responseTime);
      } else {
        this.recordFailure(`HTTP ${response.status}`, 'health_check');
      }
    } catch (error) {
      this.recordFailure(
        error instanceof Error ? error.message : 'Health check failed',
        'health_check',
      );
    }
  }

  // 获取连接健康状态
  getHealth(): ConnectionHealth {
    return { ...this.health };
  }

  // 检查是否需要恢复
  shouldRecover(): boolean {
    return !this.health.isHealthy && !this.isRecovering;
  }

  // 开始恢复过程
  async startRecovery(): Promise<void> {
    if (this.isRecovering) return;

    this.isRecovering = true;
    console.log('Starting connection recovery...');

    // 等待一段时间后重置健康状态
    await new Promise(resolve => setTimeout(resolve, this.config.recoveryDelay));
    
    this.health.isHealthy = true;
    this.health.consecutiveFailures = 0;
    this.isRecovering = false;

    console.log('Connection recovery completed');
  }

  // 获取稳定性报告
  getStabilityReport() {
    return {
      health: this.getHealth(),
      monitor: connectionStabilityMonitor.getStabilityReport(),
      debug: connectionDebugger.getSummary()
    };
  }

  // 清理资源
  destroy(): void {
    this.stopHealthCheck();
  }
} 