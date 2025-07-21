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

    // 只保留最近50条记录
    if (this.disconnectionHistory.length > 50) {
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

  recordConnectionAttempt(sessionId: string, userId: string, success: boolean) {
    const key = `${sessionId}-${userId}`;
    
    if (success) {
      this.lastSuccessfulConnection.set(key, Date.now());
      this.connectionAttempts.set(key, 0); // 重置尝试次数
    } else {
      const attempts = this.connectionAttempts.get(key) || 0;
      this.connectionAttempts.set(key, attempts + 1);
    }
  }

  getStabilityReport() {
    const now = Date.now();
    const recentDisconnections = this.disconnectionHistory.filter(
      d => now - d.timestamp < 300000 // 最近5分钟
    );

    const totalAttempts = Array.from(this.connectionAttempts.values()).reduce((sum, count) => sum + count, 0);
    const successfulConnections = Array.from(this.lastSuccessfulConnection.values()).filter(
      time => now - time < 300000 // 最近5分钟
    ).length;

    return {
      totalDisconnections: this.disconnectionHistory.length,
      recentDisconnections: recentDisconnections.length,
      totalConnectionAttempts: totalAttempts,
      recentSuccessfulConnections: successfulConnections,
      averageDisconnectionInterval: this.calculateAverageDisconnectionInterval(),
      lastDisconnection: this.disconnectionHistory[this.disconnectionHistory.length - 1] || null
    };
  }

  getDisconnectionHistory() {
    return this.disconnectionHistory.slice(-20); // 返回最近20条记录
  }

  clearHistory() {
    this.disconnectionHistory = [];
    this.connectionAttempts.clear();
    this.lastSuccessfulConnection.clear();
  }

  private calculateAverageDisconnectionInterval(): number {
    if (this.disconnectionHistory.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < this.disconnectionHistory.length; i++) {
      const interval = this.disconnectionHistory[i].timestamp - this.disconnectionHistory[i - 1].timestamp;
      intervals.push(interval);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }
}

// 导出单例实例
export const connectionStabilityMonitor = new ConnectionStabilityMonitor(); 