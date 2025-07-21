import { NextResponse } from 'next/server';
import { redisSessionStore } from '@/lib/redis-session-store';

export async function GET() {
  try {
    // 检查Redis连接
    await redisSessionStore.getStats();
    
    return NextResponse.json(
      { 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        platform: 'render'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
} 