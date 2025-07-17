import { NextRequest, NextResponse } from 'next/server';
import { redisSessionStore } from '@/lib/redis-session-store';
import { connectionPool } from '@/lib/connection-pool';
import { heartbeatManager } from '@/lib/heartbeat-manager';
import { messageOptimizer } from '@/lib/message-optimizer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // 'redis', 'connections', 'heartbeat', 'messages', 'system', 'performance'
    
    // 根据category参数返回特定类别的统计信息
    if (category) {
      switch (category) {
        case 'redis':
          return NextResponse.json(await redisSessionStore.getStats());
        case 'connections':
          return NextResponse.json(connectionPool.getStats());
        case 'heartbeat':
          return NextResponse.json(heartbeatManager.getStats());
        case 'messages':
          return NextResponse.json(messageOptimizer.getBatchStats());
        case 'system':
          return NextResponse.json({
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            pid: process.pid,
            nodeVersion: process.version,
            platform: process.platform,
          });
        case 'performance':
          const poolStats = connectionPool.getStats();
          const heartbeatStats = heartbeatManager.getStats();
          return NextResponse.json({
            timestamp: new Date().toISOString(),
            performance: {
              connectionUtilization: poolStats.totalConnections / (poolStats.totalSessions * 20) * 100, // 假设每个会话最多20个连接
              averageConnectionsPerSession: poolStats.totalSessions > 0 ? poolStats.totalConnections / poolStats.totalSessions : 0,
              heartbeatSuccessRate: heartbeatStats.totalHeartbeats > 0 ? 
                (heartbeatStats.totalHeartbeats - heartbeatStats.inactiveHeartbeats) / heartbeatStats.totalHeartbeats * 100 : 100,
            }
          });
        default:
          return NextResponse.json(
            { error: 'Invalid category' },
            { status: 400 }
          );
      }
    }
    
    // 获取Redis统计信息
    const redisStats = await redisSessionStore.getStats();
    
    // 获取连接池统计信息
    const poolStats = connectionPool.getStats();
    
    // 获取心跳统计信息
    const heartbeatStats = heartbeatManager.getStats();
    
    // 获取消息优化统计信息
    const messageStats = messageOptimizer.getBatchStats();
    
    // 获取系统资源使用情况
    const systemStats = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
    };

    const stats = {
      timestamp: new Date().toISOString(),
      redis: redisStats,
      connections: poolStats,
      heartbeat: heartbeatStats,
      messages: messageStats,
      system: systemStats,
      performance: {
        // 计算性能指标
        connectionUtilization: poolStats.totalConnections / (poolStats.totalSessions * 20) * 100, // 假设每个会话最多20个连接
        averageConnectionsPerSession: poolStats.totalSessions > 0 ? poolStats.totalConnections / poolStats.totalSessions : 0,
        heartbeatSuccessRate: heartbeatStats.totalHeartbeats > 0 ? 
          (heartbeatStats.totalHeartbeats - heartbeatStats.inactiveHeartbeats) / heartbeatStats.totalHeartbeats * 100 : 100,
      }
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