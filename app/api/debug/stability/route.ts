import { NextRequest, NextResponse } from 'next/server';
import { connectionStabilityMonitor } from '@/lib/connection-stability-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'report':
        return NextResponse.json({
          success: true,
          timestamp: new Date().toISOString(),
          stability: connectionStabilityMonitor.getStabilityReport()
        });

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
          stability: connectionStabilityMonitor.getStabilityReport(),
          history: connectionStabilityMonitor.getDisconnectionHistory()
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reason, connectionType, duration } = body;

    if (reason && connectionType && duration) {
      connectionStabilityMonitor.logDisconnection(reason, connectionType, duration);
      return NextResponse.json({
        success: true,
        message: 'Disconnection logged'
      });
    } else {
      return NextResponse.json(
        { error: 'Missing required fields: reason, connectionType, duration' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to log disconnection:', error);
    return NextResponse.json(
      { error: 'Failed to log disconnection' },
      { status: 500 }
    );
  }
} 