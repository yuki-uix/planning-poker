import { NextResponse } from 'next/server';
import { redisSessionStore } from '@/lib/redis-session-store';
import { connectionStabilityMonitor } from '@/lib/connection-stability-monitor';

export async function GET() {
  try {
    // 检查Redis连接
    let redisStatus = 'unknown';
    try {
      await redisSessionStore.getStats();
      redisStatus = 'connected';
    } catch (error) {
      redisStatus = 'disconnected';
      console.error('Redis connection check failed:', error);
    }

    // 获取连接稳定性报告
    const stabilityReport = connectionStabilityMonitor.getStabilityReport();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      redis: {
        status: redisStatus
      },
      stability: {
        totalDisconnections: stabilityReport.totalDisconnections,
        recentDisconnections: stabilityReport.recentDisconnections,
        totalConnectionAttempts: stabilityReport.totalConnectionAttempts,
        recentSuccessfulConnections: stabilityReport.recentSuccessfulConnections,
        averageDisconnectionInterval: Math.round(stabilityReport.averageDisconnectionInterval / 1000)
      }
    });
  } catch (error) {
    console.error('Failed to get connection info:', error);
    return NextResponse.json(
      { error: 'Failed to get connection info' },
      { status: 500 }
    );
  }
} 