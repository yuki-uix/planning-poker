import { WebSocket } from 'ws';
import { connectionPool } from './connection-pool';

export interface HeartbeatConfig {
  interval: number; // 心跳间隔（毫秒）
  timeout: number;  // 超时时间（毫秒）
  maxMissedBeats: number; // 最大丢失心跳数
  gracePeriod: number; // 宽限期（毫秒）
  adaptiveInterval: boolean; // 是否启用自适应间隔
}

export interface ConnectionQuality {
  latency: number; // 延迟（毫秒）
  packetLoss: number; // 丢包率
  lastUpdate: number; // 最后更新时间
}

export class HeartbeatManager {
  private heartbeats: Map<string, {
    lastBeat: number;
    missedBeats: number;
    interval: NodeJS.Timeout;
    ws: WebSocket;
    quality: ConnectionQuality;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
  }> = new Map();
  
  private config: HeartbeatConfig;
  private isRunning: boolean = false;

  constructor(config: HeartbeatConfig = {
    interval: 15000, // 15秒心跳（更频繁）
    timeout: 45000,  // 45秒超时（更宽松）
    maxMissedBeats: 3, // 最多丢失3次心跳
    gracePeriod: 10000, // 10秒宽限期
    adaptiveInterval: true // 启用自适应间隔
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
      ws,
      quality: {
        latency: 0,
        packetLoss: 0,
        lastUpdate: Date.now()
      },
      consecutiveSuccesses: 0,
      consecutiveFailures: 0
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
      heartbeat.consecutiveFailures++;
      heartbeat.consecutiveSuccesses = 0;
      
      console.warn(`User ${userId} missed heartbeat ${heartbeat.missedBeats}/${this.config.maxMissedBeats}`);

      // 更新连接质量
      this.updateConnectionQuality(userId, false, timeSinceLastBeat);

      if (heartbeat.missedBeats >= this.config.maxMissedBeats) {
        console.error(`User ${userId} exceeded max missed beats, closing connection`);
        this.closeConnection(userId, 'Heartbeat timeout');
        return;
      }
    }

    // 发送心跳
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const heartbeatMessage = {
          type: 'heartbeat',
          timestamp: now,
          userId,
          sequence: heartbeat.missedBeats
        };
        
        ws.send(JSON.stringify(heartbeatMessage));
        
        heartbeat.lastBeat = now;
        connectionPool.updateHeartbeat(ws);
      } catch (error) {
        console.error(`Failed to send heartbeat to user ${userId}:`, error);
        heartbeat.missedBeats++;
        heartbeat.consecutiveFailures++;
        heartbeat.consecutiveSuccesses = 0;
        
        this.updateConnectionQuality(userId, false, timeSinceLastBeat);
        
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
  handleHeartbeatResponse(userId: string, responseTime?: number): void {
    const heartbeat = this.heartbeats.get(userId);
    if (heartbeat) {
      const now = Date.now();
      heartbeat.lastBeat = now;
      heartbeat.missedBeats = 0; // 重置丢失计数
      heartbeat.consecutiveSuccesses++;
      heartbeat.consecutiveFailures = 0;
      
      // 更新连接质量
      this.updateConnectionQuality(userId, true, responseTime || 0);
      
      // 自适应调整心跳间隔
      if (this.config.adaptiveInterval) {
        this.adjustHeartbeatInterval(userId);
      }
      
      connectionPool.updateHeartbeat(heartbeat.ws);
    }
  }

  // 更新连接质量
  private updateConnectionQuality(userId: string, success: boolean, responseTime: number): void {
    const heartbeat = this.heartbeats.get(userId);
    if (!heartbeat) return;

    const quality = heartbeat.quality;
    const now = Date.now();
    const alpha = 0.3; // 平滑因子

    if (success) {
      // 更新延迟
      if (responseTime > 0) {
        quality.latency = alpha * responseTime + (1 - alpha) * quality.latency;
      }
      
      // 更新丢包率（成功时降低）
      quality.packetLoss = Math.max(0, quality.packetLoss * 0.9);
    } else {
      // 失败时增加丢包率
      quality.packetLoss = Math.min(1, quality.packetLoss + 0.1);
    }

    quality.lastUpdate = now;
  }

  // 自适应调整心跳间隔
  private adjustHeartbeatInterval(userId: string): void {
    const heartbeat = this.heartbeats.get(userId);
    if (!heartbeat || !this.config.adaptiveInterval) return;

    const quality = heartbeat.quality;
    const baseInterval = 15000; // 基础间隔15秒
    let newInterval = baseInterval;

    // 根据连接质量调整间隔
    if (quality.packetLoss > 0.3) {
      // 高丢包率，减少间隔
      newInterval = Math.max(5000, baseInterval * 0.5);
    } else if (quality.packetLoss > 0.1) {
      // 中等丢包率，稍微减少间隔
      newInterval = Math.max(8000, baseInterval * 0.8);
    } else if (quality.latency > 1000) {
      // 高延迟，增加间隔
      newInterval = Math.min(30000, baseInterval * 1.5);
    } else if (heartbeat.consecutiveSuccesses > 10) {
      // 连续成功，可以适当增加间隔
      newInterval = Math.min(25000, baseInterval * 1.2);
    }

    // 如果间隔变化超过20%，重新设置定时器
    const currentInterval = this.config.interval;
    if (Math.abs(newInterval - currentInterval) / currentInterval > 0.2) {
      clearInterval(heartbeat.interval);
      heartbeat.interval = setInterval(() => {
        this.performHeartbeat(userId, heartbeat.ws);
      }, newInterval);
      
      console.log(`Adjusted heartbeat interval for user ${userId}: ${currentInterval}ms -> ${newInterval}ms`);
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
    quality: ConnectionQuality;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
  } | null {
    const heartbeat = this.heartbeats.get(userId);
    if (!heartbeat) return null;

    return {
      isActive: heartbeat.ws.readyState === WebSocket.OPEN,
      lastBeat: heartbeat.lastBeat,
      missedBeats: heartbeat.missedBeats,
      timeSinceLastBeat: Date.now() - heartbeat.lastBeat,
      quality: heartbeat.quality,
      consecutiveSuccesses: heartbeat.consecutiveSuccesses,
      consecutiveFailures: heartbeat.consecutiveFailures
    };
  }

  // 获取所有心跳状态
  getAllHeartbeatStatus(): Array<{
    userId: string;
    isActive: boolean;
    lastBeat: number;
    missedBeats: number;
    timeSinceLastBeat: number;
    quality: ConnectionQuality;
  }> {
    const statuses: Array<{
      userId: string;
      isActive: boolean;
      lastBeat: number;
      missedBeats: number;
      timeSinceLastBeat: number;
      quality: ConnectionQuality;
    }> = [];

    for (const [userId, heartbeat] of this.heartbeats.entries()) {
      statuses.push({
        userId,
        isActive: heartbeat.ws.readyState === WebSocket.OPEN,
        lastBeat: heartbeat.lastBeat,
        missedBeats: heartbeat.missedBeats,
        timeSinceLastBeat: Date.now() - heartbeat.lastBeat,
        quality: heartbeat.quality
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
    averageLatency: number;
    averagePacketLoss: number;
  } {
    const statuses = this.getAllHeartbeatStatus();
    const activeHeartbeats = statuses.filter(s => s.isActive).length;
    const totalMissedBeats = statuses.reduce((sum, s) => sum + s.missedBeats, 0);
    const totalLatency = statuses.reduce((sum, s) => sum + s.quality.latency, 0);
    const totalPacketLoss = statuses.reduce((sum, s) => sum + s.quality.packetLoss, 0);

    return {
      totalHeartbeats: statuses.length,
      activeHeartbeats,
      inactiveHeartbeats: statuses.length - activeHeartbeats,
      averageMissedBeats: statuses.length > 0 ? totalMissedBeats / statuses.length : 0,
      averageLatency: statuses.length > 0 ? totalLatency / statuses.length : 0,
      averagePacketLoss: statuses.length > 0 ? totalPacketLoss / statuses.length : 0
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
  interval: 15000, // 15秒心跳
  timeout: 45000,  // 45秒超时
  maxMissedBeats: 3, // 最多丢失3次心跳
  gracePeriod: 10000, // 10秒宽限期
  adaptiveInterval: true // 启用自适应间隔
}); 