import { NextRequest, NextResponse } from 'next/server';
import { connectionStabilityMonitor } from '@/lib/connection-stability-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'history':
        return NextResponse.json({
          success: true,
          timestamp: new Date().toISOString(),
          history: connectionStabilityMonitor.getDisconnectionHistory()
        });

      case 'clear':
        connectionStabilityMonitor.clearHistory();
        return NextResponse.json({
          success: true,
          message: 'Connection history cleared'
        });

      default:
        return NextResponse.json({
          success: true,
          timestamp: new Date().toISOString(),
          stability: connectionStabilityMonitor.getStabilityReport()
        });
    }
  } catch (error) {
    console.error('Failed to get stability info:', error);
    return NextResponse.json(
      { error: 'Failed to get stability info' },
      { status: 500 }
    );
  }
} 