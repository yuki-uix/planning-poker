import { WebSocket } from 'ws';
import { connectionPool } from './connection-pool';

export interface HeartbeatConfig {
  interval: number; // 心跳间隔（毫秒）
  timeout: number;  // 超时时间（毫秒）
  maxMissedBeats: number; // 最大丢失心跳数
}

export class HeartbeatManager {
  private heartbeats: Map<string, {
    lastBeat: number;
    missedBeats: number;
    interval: NodeJS.Timeout;
    ws: WebSocket;
  }> = new Map();
  
  private config: HeartbeatConfig;
  private isRunning: boolean = false;

  constructor(config: HeartbeatConfig = {
    interval: 45000, // 45秒心跳 - Render平台优化
    timeout: 75000,  // 75秒超时 - 增加云平台容错时间
    maxMissedBeats: 3 // 最多丢失3次心跳 - 提高容错性
  }) {
    this.config = config;
  }

  // 开始心跳
  startHeartbeat(userId: string, ws: WebSocket): void {
    // 如果已有心跳，先停止
    this.stopHeartbeat(userId);

    const interval = setInterval(() => {
      this.performHeartbeat(userId, ws);
    }, this.config.interval);

    this.heartbeats.set(userId, {
      lastBeat: Date.now(),
      missedBeats: 0,
      interval,
      ws
    });

    console.log(`Started heartbeat for user ${userId}`);
  }

  // 执行心跳
  private performHeartbeat(userId: string, ws: WebSocket): void {
    const heartbeat = this.heartbeats.get(userId);
    if (!heartbeat) return;

    const now = Date.now();
    const timeSinceLastBeat = now - heartbeat.lastBeat;

    // 检查是否超时
    if (timeSinceLastBeat > this.config.timeout) {
      heartbeat.missedBeats++;
      console.warn(`User ${userId} missed heartbeat ${heartbeat.missedBeats}/${this.config.maxMissedBeats}`);

      if (heartbeat.missedBeats >= this.config.maxMissedBeats) {
        console.error(`User ${userId} exceeded max missed beats, closing connection`);
        this.closeConnection(userId, 'Heartbeat timeout');
        return;
      }
    }

    // 发送心跳
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: now,
          userId
        }));
        
        heartbeat.lastBeat = now;
        connectionPool.updateHeartbeat(ws);
      } catch (error) {
        console.error(`Failed to send heartbeat to user ${userId}:`, error);
        heartbeat.missedBeats++;
        
        if (heartbeat.missedBeats >= this.config.maxMissedBeats) {
          this.closeConnection(userId, 'Heartbeat send failed');
        }
      }
    } else {
      // 连接已关闭
      this.closeConnection(userId, 'Connection closed');
    }
  }

  // 处理心跳响应
  handleHeartbeatResponse(userId: string): void {
    const heartbeat = this.heartbeats.get(userId);
    if (heartbeat) {
      heartbeat.lastBeat = Date.now();
      heartbeat.missedBeats = 0; // 重置丢失计数
      connectionPool.updateHeartbeat(heartbeat.ws);
    }
  }

  // 停止心跳
  stopHeartbeat(userId: string): void {
    const heartbeat = this.heartbeats.get(userId);
    if (heartbeat) {
      clearInterval(heartbeat.interval);
      this.heartbeats.delete(userId);
      console.log(`Stopped heartbeat for user ${userId}`);
    }
  }

  // 关闭连接
  private closeConnection(userId: string, reason: string): void {
    const heartbeat = this.heartbeats.get(userId);
    if (heartbeat) {
      if (heartbeat.ws.readyState === WebSocket.OPEN) {
        heartbeat.ws.close(1000, reason);
      }
      this.stopHeartbeat(userId);
    }
  }

  // 获取心跳状态
  getHeartbeatStatus(userId: string): {
    isActive: boolean;
    lastBeat: number;
    missedBeats: number;
    timeSinceLastBeat: number;
  } | null {
    const heartbeat = this.heartbeats.get(userId);
    if (!heartbeat) return null;

    return {
      isActive: heartbeat.ws.readyState === WebSocket.OPEN,
      lastBeat: heartbeat.lastBeat,
      missedBeats: heartbeat.missedBeats,
      timeSinceLastBeat: Date.now() - heartbeat.lastBeat
    };
  }

  // 获取所有心跳状态
  getAllHeartbeatStatus(): Array<{
    userId: string;
    isActive: boolean;
    lastBeat: number;
    missedBeats: number;
    timeSinceLastBeat: number;
  }> {
    const statuses: Array<{
      userId: string;
      isActive: boolean;
      lastBeat: number;
      missedBeats: number;
      timeSinceLastBeat: number;
    }> = [];

    for (const [userId, heartbeat] of this.heartbeats.entries()) {
      statuses.push({
        userId,
        isActive: heartbeat.ws.readyState === WebSocket.OPEN,
        lastBeat: heartbeat.lastBeat,
        missedBeats: heartbeat.missedBeats,
        timeSinceLastBeat: Date.now() - heartbeat.lastBeat
      });
    }

    return statuses;
  }

  // 获取心跳统计信息
  getStats(): {
    totalHeartbeats: number;
    activeHeartbeats: number;
    inactiveHeartbeats: number;
    averageMissedBeats: number;
  } {
    const statuses = this.getAllHeartbeatStatus();
    const activeHeartbeats = statuses.filter(s => s.isActive).length;
    const totalMissedBeats = statuses.reduce((sum, s) => sum + s.missedBeats, 0);

    return {
      totalHeartbeats: statuses.length,
      activeHeartbeats,
      inactiveHeartbeats: statuses.length - activeHeartbeats,
      averageMissedBeats: statuses.length > 0 ? totalMissedBeats / statuses.length : 0
    };
  }

  // 停止所有心跳
  stopAllHeartbeats(): void {
    for (const [userId] of this.heartbeats.entries()) {
      this.stopHeartbeat(userId);
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<HeartbeatConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Updated heartbeat config:', this.config);
  }

  // 检查是否运行中
  isActive(): boolean {
    return this.heartbeats.size > 0;
  }
}

// 导出单例实例
export const heartbeatManager = new HeartbeatManager({
  interval: 45000, // 45秒心跳 - Render平台优化
  timeout: 75000,  // 75秒超时 - 增加云平台容错时间
  maxMissedBeats: 3 // 最多丢失3次心跳 - 提高容错性
}); 