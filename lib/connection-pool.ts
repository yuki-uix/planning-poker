import { WebSocket } from 'ws';

export interface ConnectionMetadata {
  sessionId: string;
  userId: string;
  connectionId: string;
  connectedAt: number;
  lastHeartbeat: number;
  quality: {
    latency: number;
    packetLoss: number;
    stability: number;
  };
}

export class ConnectionPool {
  private pools: Map<string, Set<WebSocket>> = new Map();
  private metadata: Map<WebSocket, ConnectionMetadata> = new Map();
  private maxPoolSize: number;
  private healthCheckInterval: number;
  private heartbeatTimeout: number;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private qualityCheckTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    maxPoolSize?: number;
    healthCheckInterval?: number;
    heartbeatTimeout?: number;
  } = {}) {
    this.maxPoolSize = options.maxPoolSize || 50;
    this.healthCheckInterval = options.healthCheckInterval || 15000; // 15秒（更频繁）
    this.heartbeatTimeout = options.heartbeatTimeout || 45000; // 45秒（更宽松）
    this.startHealthCheck();
    this.startQualityCheck();
  }

  // 添加连接到池
  addConnection(sessionId: string, ws: WebSocket, metadata: Omit<ConnectionMetadata, 'connectedAt' | 'lastHeartbeat' | 'quality'>): boolean {
    if (!this.pools.has(sessionId)) {
      this.pools.set(sessionId, new Set());
    }

    const pool = this.pools.get(sessionId)!;
    if (pool.size >= this.maxPoolSize) {
      console.warn(`Session ${sessionId} connection pool is full (${this.maxPoolSize} connections)`);
      return false; // 池已满
    }

    pool.add(ws);
    this.metadata.set(ws, {
      ...metadata,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      quality: {
        latency: 0,
        packetLoss: 0,
        stability: 1
      }
    });

    console.log(`Added connection to session ${sessionId}, pool size: ${pool.size}`);
    return true;
  }

  // 从池中移除连接
  removeConnection(sessionId: string, ws: WebSocket): void {
    const pool = this.pools.get(sessionId);
    if (pool) {
      pool.delete(ws);
      this.metadata.delete(ws);
      
      if (pool.size === 0) {
        this.pools.delete(sessionId);
        console.log(`Removed empty pool for session ${sessionId}`);
      } else {
        console.log(`Removed connection from session ${sessionId}, pool size: ${pool.size}`);
      }
    }
  }

  // 获取会话的所有连接
  getSessionConnections(sessionId: string): WebSocket[] {
    const pool = this.pools.get(sessionId);
    return pool ? Array.from(pool) : [];
  }

  // 获取会话连接数
  getSessionConnectionCount(sessionId: string): number {
    const pool = this.pools.get(sessionId);
    return pool ? pool.size : 0;
  }

  // 获取连接元数据
  getConnectionMetadata(ws: WebSocket): ConnectionMetadata | undefined {
    return this.metadata.get(ws);
  }

  // 更新连接心跳
  updateHeartbeat(ws: WebSocket): void {
    const metadata = this.metadata.get(ws);
    if (metadata) {
      metadata.lastHeartbeat = Date.now();
    }
  }

  // 更新连接质量
  updateConnectionQuality(ws: WebSocket, quality: Partial<ConnectionMetadata['quality']>): void {
    const metadata = this.metadata.get(ws);
    if (metadata) {
      metadata.quality = { ...metadata.quality, ...quality };
    }
  }

  // 广播消息到会话
  broadcastToSession(sessionId: string, message: Record<string, unknown>): Promise<void> {
    return new Promise((resolve) => {
      const connections = this.getSessionConnections(sessionId);
      if (connections.length === 0) {
        resolve();
        return;
      }

      const messageStr = JSON.stringify(message);
      let sentCount = 0;
      let errorCount = 0;

      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr, (error) => {
            if (error) {
              console.error('Failed to send message:', error);
              errorCount++;
              // 更新连接质量
              this.updateConnectionQuality(ws, { stability: 0.5 });
            } else {
              sentCount++;
              // 更新连接质量
              this.updateConnectionQuality(ws, { stability: 1 });
            }

            if (sentCount + errorCount === connections.length) {
              console.log(`Broadcast to session ${sessionId}: ${sentCount} sent, ${errorCount} failed`);
              resolve();
            }
          });
        } else {
          errorCount++;
          if (sentCount + errorCount === connections.length) {
            resolve();
          }
        }
      });
    });
  }

  // 发送消息给特定用户
  sendToUser(userId: string, message: Record<string, unknown>): Promise<boolean> {
    return new Promise((resolve) => {
      for (const [ws, metadata] of this.metadata.entries()) {
        if (metadata.userId === userId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message), (error) => {
            if (error) {
              console.error(`Failed to send message to user ${userId}:`, error);
              this.updateConnectionQuality(ws, { stability: 0.5 });
              resolve(false);
            } else {
              this.updateConnectionQuality(ws, { stability: 1 });
              resolve(true);
            }
          });
          return;
        }
      }
      resolve(false); // 用户未找到
    });
  }

  // 健康检查，清理无效连接
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  // 质量检查，监控连接质量
  private startQualityCheck(): void {
    this.qualityCheckTimer = setInterval(() => {
      this.performQualityCheck();
    }, 30000); // 30秒检查一次质量
  }

  private performHealthCheck(): void {
    const now = Date.now();
    let totalCleaned = 0;

    this.pools.forEach((pool, sessionId) => {
      const validConnections = new Set<WebSocket>();
      let cleaned = 0;

      pool.forEach(ws => {
        const metadata = this.metadata.get(ws);
        if (ws.readyState === WebSocket.OPEN && metadata) {
          // 检查心跳超时
          if (now - metadata.lastHeartbeat < this.heartbeatTimeout) {
            validConnections.add(ws);
          } else {
            console.log(`Connection ${metadata.connectionId} timed out, removing from session ${sessionId}`);
            this.metadata.delete(ws);
            cleaned++;
          }
        } else {
          // 连接已关闭
          this.metadata.delete(ws);
          cleaned++;
        }
      });

      if (cleaned > 0) {
        this.pools.set(sessionId, validConnections);
        totalCleaned += cleaned;
        console.log(`Cleaned ${cleaned} invalid connections from session ${sessionId}`);
      }

      if (validConnections.size === 0) {
        this.pools.delete(sessionId);
        console.log(`Removed empty pool for session ${sessionId}`);
      }
    });

    if (totalCleaned > 0) {
      console.log(`Health check completed: cleaned ${totalCleaned} invalid connections`);
    }
  }

  private performQualityCheck(): void {
    this.pools.forEach((pool, sessionId) => {
      const qualityStats = {
        totalConnections: pool.size,
        highQualityConnections: 0,
        mediumQualityConnections: 0,
        lowQualityConnections: 0,
        averageLatency: 0,
        averageStability: 0
      };

      let totalLatency = 0;
      let totalStability = 0;

      pool.forEach(ws => {
        const metadata = this.metadata.get(ws);
        if (metadata) {
          totalLatency += metadata.quality.latency;
          totalStability += metadata.quality.stability;

          if (metadata.quality.stability > 0.7) {
            qualityStats.highQualityConnections++;
          } else if (metadata.quality.stability > 0.3) {
            qualityStats.mediumQualityConnections++;
          } else {
            qualityStats.lowQualityConnections++;
          }
        }
      });

      if (qualityStats.totalConnections > 0) {
        qualityStats.averageLatency = totalLatency / qualityStats.totalConnections;
        qualityStats.averageStability = totalStability / qualityStats.totalConnections;

        console.log(`Session ${sessionId} quality stats:`, qualityStats);
      }
    });
  }

  // 获取池统计信息
  getStats(): {
    totalSessions: number;
    totalConnections: number;
    sessionStats: Array<{ 
      sessionId: string; 
      connectionCount: number;
      averageQuality: number;
    }>;
  } {
    const sessionStats: Array<{ 
      sessionId: string; 
      connectionCount: number;
      averageQuality: number;
    }> = [];
    let totalConnections = 0;

    this.pools.forEach((pool, sessionId) => {
      const count = pool.size;
      let totalQuality = 0;
      let qualityCount = 0;

      pool.forEach(ws => {
        const metadata = this.metadata.get(ws);
        if (metadata) {
          totalQuality += metadata.quality.stability;
          qualityCount++;
        }
      });

      const averageQuality = qualityCount > 0 ? totalQuality / qualityCount : 0;
      sessionStats.push({ sessionId, connectionCount: count, averageQuality });
      totalConnections += count;
    });

    return {
      totalSessions: this.pools.size,
      totalConnections,
      sessionStats,
    };
  }

  // 关闭所有连接
  closeAllConnections(): void {
    this.pools.forEach((pool) => {
      pool.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Server shutdown');
        }
      });
    });

    this.pools.clear();
    this.metadata.clear();
  }

  // 停止健康检查
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.qualityCheckTimer) {
      clearInterval(this.qualityCheckTimer);
      this.qualityCheckTimer = null;
    }
  }
}

// 导出单例实例
export const connectionPool = new ConnectionPool({
  maxPoolSize: 50,
  healthCheckInterval: 15000, // 15秒
  heartbeatTimeout: 45000 // 45秒
}); 