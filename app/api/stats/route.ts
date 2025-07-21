import { NextResponse } from 'next/server';
import { redisSessionStore } from '@/lib/redis-session-store';
import { connectionStabilityMonitor } from '@/lib/connection-stability-monitor';

export async function GET() {
  try {
    // 获取Redis统计信息
    const redisStats = await redisSessionStore.getStats();
    
    // 获取连接稳定性统计信息
    const stabilityStats = connectionStabilityMonitor.getStabilityReport();
    
    // 获取系统资源使用情况
    const systemStats = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
    };

    const stats = {
      timestamp: new Date().toISOString(),
      redis: redisStats,
      stability: {
        totalDisconnections: stabilityStats.totalDisconnections,
        recentDisconnections: stabilityStats.recentDisconnections,
        totalConnectionAttempts: stabilityStats.totalConnectionAttempts,
        recentSuccessfulConnections: stabilityStats.recentSuccessfulConnections,
        averageDisconnectionInterval: Math.round(stabilityStats.averageDisconnectionInterval / 1000)
      },
      system: systemStats
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
} 