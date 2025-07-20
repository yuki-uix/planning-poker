// 连接调试工具
// 用于生产环境诊断连接问题

export interface ConnectionDebugInfo {
  timestamp: number;
  connectionType: 'sse' | 'websocket' | 'http' | 'disconnected';
  isConnected: boolean;
  isConnecting: boolean;
  lastHeartbeat: number;
  reconnectAttempts: number;
  error?: string;
  networkInfo?: {
    userAgent: string;
    connection?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
}

export class ConnectionDebugger {
  private debugLog: ConnectionDebugInfo[] = [];
  private maxLogSize = 100;

  // 记录连接状态变化
  logStateChange(info: Omit<ConnectionDebugInfo, 'timestamp'>): void {
    const debugInfo: ConnectionDebugInfo = {
      ...info,
      timestamp: Date.now(),
      networkInfo: this.getNetworkInfo()
    };

    this.debugLog.push(debugInfo);
    
    // 保持日志大小限制
    if (this.debugLog.length > this.maxLogSize) {
      this.debugLog.shift();
    }

    // 生产环境日志
    if (process.env.NODE_ENV === 'production') {
      console.log('[Connection Debug]', {
        type: debugInfo.connectionType,
        connected: debugInfo.isConnected,
        connecting: debugInfo.isConnecting,
        heartbeat: debugInfo.lastHeartbeat,
        attempts: debugInfo.reconnectAttempts,
        error: debugInfo.error,
        network: debugInfo.networkInfo
      });
    }
  }

  // 获取网络信息
  private getNetworkInfo(): ConnectionDebugInfo['networkInfo'] {
    if (typeof window === 'undefined') {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    return {
      userAgent: navigator.userAgent,
      connection: connection?.effectiveType,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt
    };
  }

  // 获取调试日志
  getDebugLog(): ConnectionDebugInfo[] {
    return [...this.debugLog];
  }

  // 导出调试信息
  exportDebugInfo(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      log: this.debugLog,
      summary: this.getSummary()
    }, null, 2);
  }

  // 获取连接统计摘要
  getSummary(): {
    totalConnections: number;
    successfulConnections: number;
    failedConnections: number;
    averageReconnectAttempts: number;
    mostUsedConnectionType: string;
  } {
    const total = this.debugLog.length;
    const successful = this.debugLog.filter(log => log.isConnected).length;
    const failed = this.debugLog.filter(log => !log.isConnected && log.error).length;
    const avgAttempts = this.debugLog.reduce((sum, log) => sum + log.reconnectAttempts, 0) / total || 0;
    
    const typeCounts = this.debugLog.reduce((acc, log) => {
      acc[log.connectionType] = (acc[log.connectionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostUsed = Object.entries(typeCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

    return {
      totalConnections: total,
      successfulConnections: successful,
      failedConnections: failed,
      averageReconnectAttempts: Math.round(avgAttempts * 100) / 100,
      mostUsedConnectionType: mostUsed
    };
  }

  // 清除日志
  clear(): void {
    this.debugLog = [];
  }
}

// 全局调试器实例
export const connectionDebugger = new ConnectionDebugger(); 