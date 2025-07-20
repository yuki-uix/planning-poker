import { WebSocket } from 'ws';
import { connectionPool } from './connection-pool';

interface HeartbeatInfo {
  lastBeat: number;
  missedBeats: number;
  interval: NodeJS.Timeout;
  ws: WebSocket;
  lastSuccessfulBeat: number;
}

export class HeartbeatManager {
  private heartbeats: Map<string, HeartbeatInfo> = new Map();
  private config = {
    interval: 15000, // 15秒心跳间隔（更频繁）
    timeout: 45000,  // 45秒超时（更宽松）
    maxMissedBeats: 3, // 最多丢失3次心跳
    retryInterval: 5000 // 重试间隔
  };

  startHeartbeat(userId: string, ws: WebSocket): void {
    // 停止现有的心跳
    this.stopHeartbeat(userId);

    const interval = setInterval(() => {
      this.performHeartbeat(userId, ws);
    }, this.config.interval);

    this.heartbeats.set(userId, {
      lastBeat: Date.now(),
      missedBeats: 0,
      interval,
      ws,
      lastSuccessfulBeat: Date.now()
    });

    console.log(`Started heartbeat for user ${userId}`);
  }

  stopHeartbeat(userId: string): void {
    const heartbeat = this.heartbeats.get(userId);
    if (heartbeat) {
      clearInterval(heartbeat.interval);
      this.heartbeats.delete(userId);
      console.log(`Stopped heartbeat for user ${userId}`);
    }
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
          userId,
          sessionId: (ws as WebSocket & { sessionId?: string }).sessionId
        }));
        
        heartbeat.lastBeat = now;
        heartbeat.lastSuccessfulBeat = now;
        heartbeat.missedBeats = 0; // 重置丢失计数
        
        // 更新连接池中的心跳状态
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

  private closeConnection(userId: string, reason: string): void {
    const heartbeat = this.heartbeats.get(userId);
    if (heartbeat) {
      console.log(`Closing connection for user ${userId}: ${reason}`);
      heartbeat.ws.close(1000, reason);
      this.stopHeartbeat(userId);
    }
  }

  // 获取心跳统计
  getHeartbeatStats(): Array<{ userId: string; lastBeat: number; missedBeats: number; status: string }> {
    return Array.from(this.heartbeats.entries()).map(([userId, heartbeat]) => ({
      userId,
      lastBeat: heartbeat.lastBeat,
      missedBeats: heartbeat.missedBeats,
      status: heartbeat.missedBeats > 0 ? 'warning' : 'healthy'
    }));
  }

  // 检查用户是否活跃
  isUserActive(userId: string): boolean {
    const heartbeat = this.heartbeats.get(userId);
    if (!heartbeat) return false;

    const now = Date.now();
    return now - heartbeat.lastSuccessfulBeat < this.config.timeout;
  }
}

// 导出单例实例
export const heartbeatManager = new HeartbeatManager(); 