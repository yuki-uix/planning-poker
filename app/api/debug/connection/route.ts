import { NextRequest, NextResponse } from 'next/server';
import { redisSessionStore } from '@/lib/redis-session-store';
import { connectionStabilityMonitor } from '@/lib/connection-stability-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    // 检查Redis连接
    let redisStatus = 'unknown';
    try {
      await redisSessionStore.getStats();
      redisStatus = 'connected';
    } catch (error) {
      redisStatus = 'disconnected';
      console.error('Redis connection check failed:', error);
    }

    // 获取会话信息
    let sessionInfo = null;
    if (sessionId) {
      try {
        sessionInfo = await redisSessionStore.getSession(sessionId);
      } catch (error) {
        console.error('Failed to get session info:', error);
      }
    }

    // 获取连接统计
    const stabilityReport = connectionStabilityMonitor.getStabilityReport();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      redis: {
        status: redisStatus
      },
      session: sessionInfo ? {
        id: sessionInfo.id,
        userCount: sessionInfo.users.length,
        createdAt: sessionInfo.createdAt,
        revealed: sessionInfo.revealed
      } : null,
      stability: stabilityReport,
      user: userId ? {
        id: userId,
        inSession: sessionInfo?.users.some(u => u.id === userId) || false
      } : null
    });
  } catch (error) {
    console.error('Failed to get connection info:', error);
    return NextResponse.json(
      { error: 'Failed to get connection info' },
      { status: 500 }
    );
  }
} 