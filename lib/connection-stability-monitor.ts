export class ConnectionStabilityMonitor {
  private disconnectionHistory: Array<{
    timestamp: number;
    reason: string;
    connectionType: string;
    duration: number;
    sessionId?: string;
    userId?: string;
  }> = [];

  private connectionAttempts: Map<string, number> = new Map();
  private lastSuccessfulConnection: Map<string, number> = new Map();

  logDisconnection(reason: string, connectionType: string, duration: number, sessionId?: string, userId?: string) {
    const disconnection = {
      timestamp: Date.now(),
      reason,
      connectionType,
      duration,
      sessionId,
      userId
    };

    this.disconnectionHistory.push(disconnection);

    // 只保留最近100条记录
    if (this.disconnectionHistory.length > 100) {
      this.disconnectionHistory.shift();
    }

    console.warn(`Connection lost: ${reason} (${connectionType}) after ${duration}ms`, {
      sessionId,
      userId,
      timestamp: new Date().toISOString()
    });

    // 记录连接尝试
    const key = `${sessionId}-${userId}`;
    const attempts = this.connectionAttempts.get(key) || 0;
    this.connectionAttempts.set(key, attempts + 1);
  }

  logSuccessfulConnection(sessionId: string, userId: string, connectionType: string) {
    const key = `${sessionId}-${userId}`;
    this.lastSuccessfulConnection.set(key, Date.now());
    this.connectionAttempts.set(key, 0); // 重置尝试次数
    
    console.log(`Connection established: ${connectionType} for ${userId} in session ${sessionId}`);
  }

  getStabilityReport() {
    const recentDisconnections = this.disconnectionHistory.filter(
      d => Date.now() - d.timestamp < 300000 // 最近5分钟
    );

    const totalConnections = Array.from(this.lastSuccessfulConnection.values()).length;
    const failedConnections = Array.from(this.connectionAttempts.values()).reduce((sum, attempts) => sum + attempts, 0);

    return {
      totalDisconnections: this.disconnectionHistory.length,
      recentDisconnections: recentDisconnections.length,
      totalConnections,
      failedConnections,
      successRate: totalConnections > 0 ? ((totalConnections - failedConnections) / totalConnections * 100).toFixed(2) : '0',
      averageDisconnectionInterval: this.calculateAverageInterval(),
      mostCommonReason: this.getMostCommonReason(),
      connectionTypeDistribution: this.getConnectionTypeDistribution(),
      problematicSessions: this.getProblematicSessions()
    };
  }

  getDisconnectionHistory() {
    return this.disconnectionHistory.map(d => ({
      ...d,
      timestamp: new Date(d.timestamp).toISOString()
    }));
  }

  clearHistory() {
    this.disconnectionHistory = [];
    this.connectionAttempts.clear();
    this.lastSuccessfulConnection.clear();
  }

  private calculateAverageInterval(): number {
    if (this.disconnectionHistory.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < this.disconnectionHistory.length; i++) {
      intervals.push(this.disconnectionHistory[i].timestamp - this.disconnectionHistory[i-1].timestamp);
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
    const typeCounts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return typeCounts;
  }

  private getProblematicSessions() {
    const sessionStats = new Map<string, { disconnections: number, lastSeen: number }>();
    
    this.disconnectionHistory.forEach(d => {
      if (d.sessionId) {
        const stats = sessionStats.get(d.sessionId) || { disconnections: 0, lastSeen: 0 };
        stats.disconnections++;
        stats.lastSeen = Math.max(stats.lastSeen, d.timestamp);
        sessionStats.set(d.sessionId, stats);
      }
    });

    return Array.from(sessionStats.entries())
      .filter(([, stats]) => stats.disconnections > 3)
      .map(([sessionId, stats]) => ({
        sessionId,
        disconnections: stats.disconnections,
        lastSeen: new Date(stats.lastSeen).toISOString()
      }));
  }
}

// 导出单例实例
export const connectionStabilityMonitor = new ConnectionStabilityMonitor(); 