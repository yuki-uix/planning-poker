import { WebSocket } from 'ws';

export interface ConnectionMetadata {
  sessionId: string;
  userId: string;
  connectionId: string;
  connectedAt: number;
  lastHeartbeat: number;
}

export class ConnectionPool {
  private pools: Map<string, Set<WebSocket>> = new Map();
  private metadata: Map<WebSocket, ConnectionMetadata> = new Map();
  private maxPoolSize: number;
  private healthCheckInterval: number;
  private heartbeatTimeout: number;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    maxPoolSize?: number;
    healthCheckInterval?: number;
    heartbeatTimeout?: number;
  } = {}) {
    this.maxPoolSize = options.maxPoolSize || 50;
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30秒
    this.heartbeatTimeout = options.heartbeatTimeout || 35000; // 35秒
    this.startHealthCheck();
  }

  // 添加连接到池
  addConnection(sessionId: string, ws: WebSocket, metadata: Omit<ConnectionMetadata, 'connectedAt' | 'lastHeartbeat'>): boolean {
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
            } else {
              sentCount++;
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
              resolve(false);
            } else {
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

  // 获取池统计信息
  getStats(): {
    totalSessions: number;
    totalConnections: number;
    sessionStats: Array<{ sessionId: string; connectionCount: number }>;
  } {
    const sessionStats: Array<{ sessionId: string; connectionCount: number }> = [];
    let totalConnections = 0;

    this.pools.forEach((pool, sessionId) => {
      const count = pool.size;
      sessionStats.push({ sessionId, connectionCount: count });
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
  }
}

// 导出单例实例
export const connectionPool = new ConnectionPool({
  maxPoolSize: 50,
  healthCheckInterval: 30000,
  heartbeatTimeout: 35000,
}); 