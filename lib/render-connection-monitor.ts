export class RenderConnectionMonitor {
  private connectionHistory: Array<{
    timestamp: number;
    type: 'connect' | 'disconnect' | 'reconnect' | 'error';
    sessionId: string;
    userId: string;
    duration?: number;
    error?: string;
    connectionType: 'sse' | 'http';
    platform: 'render';
  }> = [];

  logConnectionEvent(event: {
    type: 'connect' | 'disconnect' | 'reconnect' | 'error';
    sessionId: string;
    userId: string;
    duration?: number;
    error?: string;
    connectionType: 'sse' | 'http';
  }) {
    const logEvent = {
      ...event,
      timestamp: Date.now(),
      platform: 'render' as const,
      service: process.env.RENDER_SERVICE_NAME || 'unknown'
    };

    this.connectionHistory.push(logEvent);

    // 只保留最近100条记录
    if (this.connectionHistory.length > 100) {
      this.connectionHistory.shift();
    }

    console.log('Render Connection Event:', {
      ...logEvent,
      timestamp: new Date(logEvent.timestamp).toISOString()
    });
  }

  getConnectionStats() {
    const now = Date.now();
    const recentEvents = this.connectionHistory.filter(
      event => now - event.timestamp < 300000 // 最近5分钟
    );

    const sseConnections = recentEvents.filter(e => e.connectionType === 'sse').length;
    const httpConnections = recentEvents.filter(e => e.connectionType === 'http').length;
    const errors = recentEvents.filter(e => e.type === 'error').length;

    return {
      totalEvents: this.connectionHistory.length,
      recentEvents: recentEvents.length,
      sseConnections,
      httpConnections,
      errors,
      platform: 'render'
    };
  }

  getRecentEvents(limit: number = 20) {
    return this.connectionHistory.slice(-limit);
  }

  clearHistory() {
    this.connectionHistory = [];
  }
}

// 导出单例实例
export const renderConnectionMonitor = new RenderConnectionMonitor(); 