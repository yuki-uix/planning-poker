// 智能重连管理器
// 提供更智能的重连策略，根据网络稳定性和连接质量动态调整重连行为

export class SmartReconnectionManager {
  private config = {
    maxAttempts: 15,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.1,
    successThreshold: 3, // 连续成功次数阈值
    failureThreshold: 5,  // 连续失败次数阈值
    stabilityRecoveryRate: 0.1, // 稳定性恢复速率
    stabilityDecayRate: 0.2 // 稳定性衰减速率
  };

  private attemptCount = 0;
  private consecutiveSuccesses = 0;
  private consecutiveFailures = 0;
  private lastSuccessTime = 0;
  private networkStability = 1.0;
  private reconnectionHistory: Array<{ success: boolean; responseTime: number; timestamp: number; delay: number }> = [];

  constructor() {
    this.lastSuccessTime = Date.now();
  }

  // 智能重连延迟计算
  getReconnectionDelay(): number {
    // 基础延迟
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, this.attemptCount);
    
    // 根据网络稳定性调整
    delay = delay / Math.max(0.3, this.networkStability);
    
    // 添加随机抖动，避免同时重连
    const jitter = delay * this.config.jitterFactor * (Math.random() - 0.5);
    delay += jitter;
    
    return Math.min(this.config.maxDelay, Math.max(100, delay));
  }

  // 记录重连结果
  recordReconnectionResult(success: boolean, responseTime: number, delay: number): void {
    const now = Date.now();
    
    // 记录重连历史
    this.reconnectionHistory.push({
      success,
      responseTime,
      timestamp: now,
      delay
    });

    // 只保留最近30次重连记录
    if (this.reconnectionHistory.length > 30) {
      this.reconnectionHistory.shift();
    }

    if (success) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
      this.lastSuccessTime = now;
      
      // 更新网络稳定性
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.networkStability = Math.min(2.0, this.networkStability + this.config.stabilityRecoveryRate);
        this.attemptCount = Math.max(0, this.attemptCount - 1);
      }
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
      
      // 降低网络稳定性
      if (this.consecutiveFailures >= this.config.failureThreshold) {
        this.networkStability = Math.max(0.3, this.networkStability - this.config.stabilityDecayRate);
      }
    }

    console.log(`Reconnection result: ${success ? 'SUCCESS' : 'FAILED'}, responseTime: ${responseTime}ms, networkStability: ${this.networkStability.toFixed(2)}`);
  }

  // 判断是否应该重连
  shouldReconnect(): boolean {
    const timeSinceLastSuccess = Date.now() - this.lastSuccessTime;
    const maxWaitTime = this.config.maxDelay * 3;
    
    return this.attemptCount < this.config.maxAttempts && 
           timeSinceLastSuccess > maxWaitTime;
  }

  // 增加重连尝试计数
  incrementAttemptCount(): void {
    this.attemptCount++;
  }

  // 重置重连状态
  resetReconnectionState(): void {
    this.attemptCount = 0;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.networkStability = 1.0;
    this.reconnectionHistory = [];
    console.log('Reconnection state reset');
  }

  // 获取重连统计
  getReconnectionStats() {
    const recentHistory = this.reconnectionHistory.slice(-20); // 最近20次
    const successCount = recentHistory.filter(h => h.success).length;
    const avgResponseTime = recentHistory.length > 0 ? 
      recentHistory.reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length : 0;
    const avgDelay = recentHistory.length > 0 ? 
      recentHistory.reduce((sum, h) => sum + h.delay, 0) / recentHistory.length : 0;
    
    return {
      attemptCount: this.attemptCount,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      networkStability: this.networkStability,
      successRate: recentHistory.length > 0 ? successCount / recentHistory.length : 0,
      averageResponseTime: avgResponseTime,
      averageDelay: avgDelay,
      lastSuccessTime: this.lastSuccessTime,
      nextDelay: this.getReconnectionDelay(),
      shouldReconnect: this.shouldReconnect()
    };
  }

  // 检查网络是否稳定
  isNetworkStable(): boolean {
    return this.networkStability > 0.7 && this.consecutiveFailures < 2;
  }

  // 获取建议的连接策略
  getRecommendedStrategy(): 'aggressive' | 'moderate' | 'conservative' {
    if (this.networkStability > 0.8 && this.consecutiveSuccesses >= 5) {
      return 'aggressive'; // 网络稳定，可以更积极地重连
    } else if (this.networkStability > 0.5 && this.consecutiveFailures < 3) {
      return 'moderate'; // 网络一般，使用中等策略
    } else {
      return 'conservative'; // 网络不稳定，使用保守策略
    }
  }

  // 根据策略调整配置
  adjustConfigForStrategy(strategy: 'aggressive' | 'moderate' | 'conservative'): void {
    switch (strategy) {
      case 'aggressive':
        this.config.baseDelay = 500;
        this.config.maxDelay = 15000;
        this.config.backoffMultiplier = 1.2;
        break;
      case 'moderate':
        this.config.baseDelay = 1000;
        this.config.maxDelay = 30000;
        this.config.backoffMultiplier = 1.5;
        break;
      case 'conservative':
        this.config.baseDelay = 2000;
        this.config.maxDelay = 60000;
        this.config.backoffMultiplier = 2.0;
        break;
    }
  }
}

// 导出单例实例
export const smartReconnectionManager = new SmartReconnectionManager(); 