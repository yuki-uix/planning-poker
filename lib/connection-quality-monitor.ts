// 连接质量监控器
// 实时监控连接质量，提供网络质量评估和连接方式建议

export interface ConnectionMetrics {
  latency: number[];
  packetLoss: number;
  jitter: number;
  bandwidth: number;
  connectionStability: number;
  responseTimeHistory: Array<{ timestamp: number; responseTime: number; success: boolean }>;
}

export interface QualityReport {
  overallScore: number;
  latencyScore: number;
  stabilityScore: number;
  reliabilityScore: number;
  recommendation: 'excellent' | 'good' | 'fair' | 'poor';
  suggestedConnectionType: 'sse' | 'websocket' | 'http';
  shouldDegrade: boolean;
  shouldUpgrade: boolean;
}

export class ConnectionQualityMonitor {
  private metrics: ConnectionMetrics = {
    latency: [],
    packetLoss: 0,
    jitter: 0,
    bandwidth: 0,
    connectionStability: 1.0,
    responseTimeHistory: []
  };

  private config = {
    sampleSize: 20,
    qualityThreshold: 0.7,
    degradationThreshold: 0.3,
    upgradeThreshold: 0.8,
    maxHistorySize: 100,
    latencyWeight: 0.3,
    stabilityWeight: 0.4,
    reliabilityWeight: 0.3
  };

  private totalRequests = 0;
  private failedRequests = 0;
  private lastUpdateTime = Date.now();

  constructor() {
    this.lastUpdateTime = Date.now();
  }

  // 记录连接质量指标
  recordMetrics(latency: number, success: boolean): void {
    const now = Date.now();
    
    // 记录响应时间历史
    this.metrics.responseTimeHistory.push({
      timestamp: now,
      responseTime: latency,
      success
    });

    // 限制历史记录大小
    if (this.metrics.responseTimeHistory.length > this.config.maxHistorySize) {
      this.metrics.responseTimeHistory.shift();
    }

    // 更新延迟统计
    this.metrics.latency.push(latency);
    if (this.metrics.latency.length > this.config.sampleSize) {
      this.metrics.latency.shift();
    }

    // 更新请求统计
    this.totalRequests++;
    if (!success) {
      this.failedRequests++;
    }

    // 计算丢包率
    this.metrics.packetLoss = this.failedRequests / this.totalRequests;

    // 计算抖动
    this.calculateJitter();

    // 更新连接稳定性评分
    this.updateConnectionStability();

    this.lastUpdateTime = now;
  }

  // 计算网络抖动
  private calculateJitter(): void {
    if (this.metrics.latency.length >= 2) {
      const recentLatencies = this.metrics.latency.slice(-10);
      const avgLatency = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;
      this.metrics.jitter = recentLatencies.reduce((sum, lat) => sum + Math.abs(lat - avgLatency), 0) / recentLatencies.length;
    }
  }

  // 更新连接稳定性评分
  private updateConnectionStability(): void {
    const recentHistory = this.metrics.responseTimeHistory.slice(-20);
    if (recentHistory.length === 0) return;

    const successCount = recentHistory.filter(h => h.success).length;
    const successRate = successCount / recentHistory.length;
    
    const avgLatency = recentHistory.reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length;
    const latencyScore = Math.max(0, 1 - avgLatency / 5000); // 5秒为基准
    
    const jitterScore = Math.max(0, 1 - this.metrics.jitter / 1000); // 1秒抖动为基准
    
    // 综合评分
    this.metrics.connectionStability = (
      successRate * 0.4 + 
      latencyScore * 0.3 + 
      jitterScore * 0.3
    );
  }

  // 获取连接质量评分
  getConnectionQuality(): number {
    return this.metrics.connectionStability;
  }

  // 获取详细质量报告
  getQualityReport(): QualityReport {
    const recentHistory = this.metrics.responseTimeHistory.slice(-20);
    const successCount = recentHistory.filter(h => h.success).length;
    const successRate = successCount / recentHistory.length;
    
    const avgLatency = recentHistory.length > 0 ? 
      recentHistory.reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length : 0;
    
    // 计算各项评分
    const latencyScore = Math.max(0, 1 - avgLatency / 5000);
    const stabilityScore = this.metrics.connectionStability;
    const reliabilityScore = successRate;

    // 综合评分
    const overallScore = (
      latencyScore * this.config.latencyWeight +
      stabilityScore * this.config.stabilityWeight +
      reliabilityScore * this.config.reliabilityWeight
    );

    // 确定建议的连接类型
    let suggestedConnectionType: 'sse' | 'websocket' | 'http' = 'http';
    if (overallScore > 0.8) {
      suggestedConnectionType = 'sse';
    } else if (overallScore > 0.5) {
      suggestedConnectionType = 'websocket';
    }

    // 确定质量等级
    let recommendation: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (overallScore > 0.8) {
      recommendation = 'excellent';
    } else if (overallScore > 0.6) {
      recommendation = 'good';
    } else if (overallScore > 0.4) {
      recommendation = 'fair';
    }

    return {
      overallScore,
      latencyScore,
      stabilityScore,
      reliabilityScore,
      recommendation,
      suggestedConnectionType,
      shouldDegrade: overallScore < this.config.degradationThreshold,
      shouldUpgrade: overallScore > this.config.upgradeThreshold
    };
  }

  // 判断是否需要降级连接方式
  shouldDegradeConnection(): boolean {
    const report = this.getQualityReport();
    return report.shouldDegrade;
  }

  // 判断是否可以升级连接方式
  canUpgradeConnection(): boolean {
    const report = this.getQualityReport();
    return report.shouldUpgrade;
  }

  // 获取建议的连接类型
  getRecommendedConnectionType(): 'sse' | 'websocket' | 'http' {
    const report = this.getQualityReport();
    return report.suggestedConnectionType;
  }

  // 获取连接统计
  getConnectionStats() {
    const recentHistory = this.metrics.responseTimeHistory.slice(-20);
    const avgLatency = recentHistory.length > 0 ? 
      recentHistory.reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length : 0;
    
    return {
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      successRate: this.totalRequests > 0 ? (this.totalRequests - this.failedRequests) / this.totalRequests : 0,
      averageLatency: avgLatency,
      currentJitter: this.metrics.jitter,
      connectionStability: this.metrics.connectionStability,
      packetLossRate: this.metrics.packetLoss,
      lastUpdateTime: this.lastUpdateTime,
      qualityReport: this.getQualityReport()
    };
  }

  // 重置监控数据
  resetMetrics(): void {
    this.metrics = {
      latency: [],
      packetLoss: 0,
      jitter: 0,
      bandwidth: 0,
      connectionStability: 1.0,
      responseTimeHistory: []
    };
    this.totalRequests = 0;
    this.failedRequests = 0;
    this.lastUpdateTime = Date.now();
    console.log('Connection quality metrics reset');
  }

  // 检查网络质量趋势
  getQualityTrend(): 'improving' | 'stable' | 'degrading' {
    const history = this.metrics.responseTimeHistory;
    if (history.length < 10) return 'stable';

    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    
    if (recent.length === 0 || older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, h) => sum + h.responseTime, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.responseTime, 0) / older.length;
    
    const recentSuccessRate = recent.filter(h => h.success).length / recent.length;
    const olderSuccessRate = older.filter(h => h.success).length / older.length;

    if (recentAvg < olderAvg * 0.8 && recentSuccessRate > olderSuccessRate) {
      return 'improving';
    } else if (recentAvg > olderAvg * 1.2 || recentSuccessRate < olderSuccessRate * 0.8) {
      return 'degrading';
    } else {
      return 'stable';
    }
  }
}

// 导出单例实例
export const connectionQualityMonitor = new ConnectionQualityMonitor(); 