export class ConnectionStabilityMonitor {
  private disconnectionHistory: Array<{
    timestamp: number;
    reason: string;
    connectionType: string;
    duration: number;
  }> = [];

  logDisconnection(reason: string, connectionType: string, duration: number) {
    this.disconnectionHistory.push({
      timestamp: Date.now(),
      reason,
      connectionType,
      duration
    });

    // 只保留最近100条记录
    if (this.disconnectionHistory.length > 100) {
      this.disconnectionHistory.shift();
    }

    console.warn(`Connection lost: ${reason} (${connectionType}) after ${duration}ms`);
  }

  getStabilityReport() {
    const recentDisconnections = this.disconnectionHistory.filter(
      d => Date.now() - d.timestamp < 300000 // 最近5分钟
    );

    return {
      totalDisconnections: this.disconnectionHistory.length,
      recentDisconnections: recentDisconnections.length,
      averageDisconnectionInterval: this.calculateAverageInterval(),
      mostCommonReason: this.getMostCommonReason(),
      connectionTypeDistribution: this.getConnectionTypeDistribution()
    };
  }

  private calculateAverageInterval(): number {
    if (this.disconnectionHistory.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < this.disconnectionHistory.length; i++) {
      intervals.push(
        this.disconnectionHistory[i].timestamp - this.disconnectionHistory[i-1].timestamp
      );
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  private getMostCommonReason(): string {
    const reasons = this.disconnectionHistory.map(d => d.reason);
    const reasonCounts = reasons.reduce((acc, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
  }

  private getConnectionTypeDistribution() {
    const types = this.disconnectionHistory.map(d => d.connectionType);
    return types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // 获取详细的断开历史
  getDisconnectionHistory() {
    return this.disconnectionHistory.map(d => ({
      ...d,
      timeAgo: Date.now() - d.timestamp
    }));
  }

  // 清除历史记录
  clearHistory() {
    this.disconnectionHistory = [];
  }
}

export const connectionStabilityMonitor = new ConnectionStabilityMonitor(); 