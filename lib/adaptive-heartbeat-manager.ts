// 自适应心跳管理器
// 根据网络质量动态调整心跳间隔和超时时间，提高连接稳定性

export class AdaptiveHeartbeatManager {
  private config = {
    baseInterval: 20000, // 基础20秒间隔
    minInterval: 10000,  // 最小10秒
    maxInterval: 60000,  // 最大60秒
    timeoutMultiplier: 2.5, // 超时倍数
    qualityThreshold: 0.8, // 网络质量阈值
    adaptiveFactor: 0.1 // 自适应因子
  };

  private networkQuality = 1.0; // 网络质量评分
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastHeartbeatTime = 0;
  private heartbeatHistory: Array<{ success: boolean; responseTime: number; timestamp: number }> = [];

  constructor() {
    this.lastHeartbeatTime = Date.now();
  }

  // 根据网络质量动态调整心跳间隔
  getAdaptiveInterval(): number {
    const qualityFactor = Math.max(0.5, this.networkQuality);
    const interval = this.config.baseInterval / qualityFactor;
    return Math.max(this.config.minInterval, Math.min(this.config.maxInterval, interval));
  }

  // 根据网络质量调整超时时间
  getAdaptiveTimeout(): number {
    return this.getAdaptiveInterval() * this.config.timeoutMultiplier;
  }

  // 记录心跳结果，更新网络质量评分
  recordHeartbeatResult(success: boolean, responseTime: number): void {
    const now = Date.now();
    
    // 记录心跳历史
    this.heartbeatHistory.push({
      success,
      responseTime,
      timestamp: now
    });

    // 只保留最近50次心跳记录
    if (this.heartbeatHistory.length > 50) {
      this.heartbeatHistory.shift();
    }

    if (success) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
      this.lastHeartbeatTime = now;
      
      // 根据响应时间调整网络质量
      const expectedTime = this.getAdaptiveInterval() * 0.3; // 期望响应时间
      const qualityDelta = Math.min(1.0, expectedTime / Math.max(100, responseTime));
      this.networkQuality = Math.min(1.0, this.networkQuality + this.config.adaptiveFactor * qualityDelta);
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
      
      // 降低网络质量评分
      this.networkQuality = Math.max(0.3, this.networkQuality - this.config.adaptiveFactor);
    }

    console.log(`Heartbeat result: ${success ? 'SUCCESS' : 'FAILED'}, responseTime: ${responseTime}ms, networkQuality: ${this.networkQuality.toFixed(2)}`);
  }

  // 获取网络质量评分
  getNetworkQuality(): number {
    return this.networkQuality;
  }

  // 获取心跳统计
  getHeartbeatStats() {
    const recentHistory = this.heartbeatHistory.slice(-20); // 最近20次
    const successCount = recentHistory.filter(h => h.success).length;
    const avgResponseTime = recentHistory.length > 0 ? 
      recentHistory.reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length : 0;
    
    return {
      networkQuality: this.networkQuality,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      successRate: recentHistory.length > 0 ? successCount / recentHistory.length : 0,
      averageResponseTime: avgResponseTime,
      currentInterval: this.getAdaptiveInterval(),
      currentTimeout: this.getAdaptiveTimeout(),
      lastHeartbeatTime: this.lastHeartbeatTime
    };
  }

  // 检查是否需要调整心跳策略
  shouldAdjustStrategy(): boolean {
    const stats = this.getHeartbeatStats();
    
    // 连续失败过多或成功率过低时调整策略
    return this.consecutiveFailures >= 3 || stats.successRate < 0.5;
  }

  // 重置网络质量评分
  resetNetworkQuality(): void {
    this.networkQuality = 1.0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.heartbeatHistory = [];
    console.log('Network quality reset to default');
  }
}

// 导出单例实例
export const adaptiveHeartbeatManager = new AdaptiveHeartbeatManager(); 