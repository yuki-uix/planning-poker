import { NextRequest, NextResponse } from "next/server";
import { RedisSessionStore } from "../../../lib/redis-session-store";
import { ConnectionPool } from "../../../lib/connection-pool";
import { HeartbeatManager } from "../../../lib/heartbeat-manager";
import { MessageOptimizer } from "../../../lib/message-optimizer";

// Dynamic imports to handle server-only dependencies
let redisSessionStore: RedisSessionStore | null = null;
let connectionPool: ConnectionPool | null = null;
let heartbeatManager: HeartbeatManager | null = null;
let messageOptimizer: MessageOptimizer | null = null;

// Initialize server-only modules
const initializeServerModules = async () => {
  if (typeof window === "undefined") {
    try {
      const redisModule = await import("../../../lib/redis-session-store");
      redisSessionStore = redisModule.redisSessionStore;

      const poolModule = await import("../../../lib/connection-pool");
      connectionPool = poolModule.connectionPool;

      const heartbeatModule = await import("../../../lib/heartbeat-manager");
      heartbeatManager = heartbeatModule.heartbeatManager;

      const optimizerModule = await import("../../../lib/message-optimizer");
      messageOptimizer = optimizerModule.messageOptimizer;
    } catch (error) {
      console.warn("Failed to import server modules:", error);
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    // Initialize server modules
    await initializeServerModules();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category"); // 'redis', 'connections', 'heartbeat', 'messages', 'system', 'performance'

    // 根据category参数返回特定类别的统计信息
    if (category) {
      switch (category) {
        case "redis":
          if (!redisSessionStore) {
            return NextResponse.json(
              { error: "Redis session store not available" },
              { status: 503 }
            );
          }
          return NextResponse.json(await redisSessionStore.getStats());
        case "connections":
          if (!connectionPool) {
            return NextResponse.json(
              { error: "Connection pool not available" },
              { status: 503 }
            );
          }
          return NextResponse.json(connectionPool.getStats());
        case "heartbeat":
          if (!heartbeatManager) {
            return NextResponse.json(
              { error: "Heartbeat manager not available" },
              { status: 503 }
            );
          }
          return NextResponse.json(heartbeatManager.getStats());
        case "messages":
          if (!messageOptimizer) {
            return NextResponse.json(
              { error: "Message optimizer not available" },
              { status: 503 }
            );
          }
          return NextResponse.json(messageOptimizer.getBatchStats());
        case "system":
          return NextResponse.json({
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            pid: process.pid,
            nodeVersion: process.version,
            platform: process.platform,
          });
        case "performance":
          if (!connectionPool || !heartbeatManager) {
            return NextResponse.json(
              { error: "Performance modules not available" },
              { status: 503 }
            );
          }
          const poolStats = connectionPool.getStats();
          const heartbeatStats = heartbeatManager.getStats();
          return NextResponse.json({
            timestamp: new Date().toISOString(),
            performance: {
              connectionUtilization:
                (poolStats.totalConnections / (poolStats.totalSessions * 20)) *
                100, // 假设每个会话最多20个连接
              averageConnectionsPerSession:
                poolStats.totalSessions > 0
                  ? poolStats.totalConnections / poolStats.totalSessions
                  : 0,
              heartbeatSuccessRate:
                heartbeatStats.totalHeartbeats > 0
                  ? ((heartbeatStats.totalHeartbeats -
                      heartbeatStats.inactiveHeartbeats) /
                      heartbeatStats.totalHeartbeats) *
                    100
                  : 100,
            },
          });
        default:
          return NextResponse.json(
            { error: "Invalid category" },
            { status: 400 }
          );
      }
    }

    // 获取统计信息 - 处理模块不可用的情况
    const stats: {
      timestamp: string;
      system: {
        memory: NodeJS.MemoryUsage;
        uptime: number;
        pid: number;
        nodeVersion: string;
        platform: string;
      };
      redis?: Awaited<ReturnType<RedisSessionStore["getStats"]>>;
      connections?: ReturnType<ConnectionPool["getStats"]>;
      heartbeat?: ReturnType<HeartbeatManager["getStats"]>;
      messages?: ReturnType<MessageOptimizer["getBatchStats"]>;
      performance?:
        | {
            connectionUtilization: number;
            averageConnectionsPerSession: number;
            heartbeatSuccessRate: number;
          }
        | { error: string };
    } = {
      timestamp: new Date().toISOString(),
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    // 只在模块可用时添加统计信息
    if (redisSessionStore) {
      try {
        stats.redis = await redisSessionStore.getStats();
      } catch {
        stats.redis = {
          error: "Failed to get Redis stats",
          totalSessions: 0,
          totalConnections: 0,
          memoryUsage: "unknown",
        } as Awaited<ReturnType<RedisSessionStore["getStats"]>> & {
          error: string;
        };
      }
    }

    if (connectionPool) {
      try {
        stats.connections = connectionPool.getStats();
      } catch {
        stats.connections = {
          error: "Failed to get connection stats",
          totalSessions: 0,
          totalConnections: 0,
          sessionStats: [],
        } as ReturnType<ConnectionPool["getStats"]> & { error: string };
      }
    }

    if (heartbeatManager) {
      try {
        stats.heartbeat = heartbeatManager.getStats();
      } catch {
        stats.heartbeat = {
          error: "Failed to get heartbeat stats",
          totalHeartbeats: 0,
          activeHeartbeats: 0,
          inactiveHeartbeats: 0,
          averageMissedBeats: 0,
        } as ReturnType<HeartbeatManager["getStats"]> & { error: string };
      }
    }

    if (messageOptimizer) {
      try {
        stats.messages = messageOptimizer.getBatchStats();
      } catch {
        stats.messages = {
          error: "Failed to get message stats",
          activeBatches: 0,
          totalBufferedMessages: 0,
          batchSizes: [],
        } as ReturnType<MessageOptimizer["getBatchStats"]> & { error: string };
      }
    }

    // 计算性能指标（如果相关模块可用）
    if (
      connectionPool &&
      heartbeatManager &&
      stats.connections &&
      stats.heartbeat
    ) {
      try {
        const poolStats = stats.connections;
        const heartbeatStats = stats.heartbeat;
        stats.performance = {
          connectionUtilization:
            (poolStats.totalConnections / (poolStats.totalSessions * 20)) * 100,
          averageConnectionsPerSession:
            poolStats.totalSessions > 0
              ? poolStats.totalConnections / poolStats.totalSessions
              : 0,
          heartbeatSuccessRate:
            heartbeatStats.totalHeartbeats > 0
              ? ((heartbeatStats.totalHeartbeats -
                  heartbeatStats.inactiveHeartbeats) /
                  heartbeatStats.totalHeartbeats) *
                100
              : 100,
        };
      } catch {
        stats.performance = {
          error: "Failed to calculate performance metrics",
        };
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get stats:", error);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
