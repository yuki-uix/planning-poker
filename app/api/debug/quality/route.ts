import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 动态导入监控器（避免服务器端导入问题）
    const { connectionQualityMonitor } = await import('@/lib/connection-quality-monitor');
    const { adaptiveHeartbeatManager } = await import('@/lib/adaptive-heartbeat-manager');
    const { smartReconnectionManager } = await import('@/lib/smart-reconnection-manager');

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        return NextResponse.json({
          success: true,
          data: {
            quality: connectionQualityMonitor.getConnectionStats(),
            heartbeat: adaptiveHeartbeatManager.getHeartbeatStats(),
            reconnection: smartReconnectionManager.getReconnectionStats()
          }
        });

      case 'report':
        return NextResponse.json({
          success: true,
          data: {
            qualityReport: connectionQualityMonitor.getQualityReport(),
            networkQuality: adaptiveHeartbeatManager.getNetworkQuality(),
            networkStability: smartReconnectionManager.getReconnectionStats().networkStability,
            recommendedStrategy: smartReconnectionManager.getRecommendedStrategy(),
            qualityTrend: connectionQualityMonitor.getQualityTrend()
          }
        });

      case 'reset':
        connectionQualityMonitor.resetMetrics();
        adaptiveHeartbeatManager.resetNetworkQuality();
        smartReconnectionManager.resetReconnectionState();
        
        return NextResponse.json({
          success: true,
          message: 'All monitoring data reset successfully'
        });

      default:
        return NextResponse.json({
          success: true,
          data: {
            quality: connectionQualityMonitor.getConnectionStats(),
            heartbeat: adaptiveHeartbeatManager.getHeartbeatStats(),
            reconnection: smartReconnectionManager.getReconnectionStats(),
            qualityReport: connectionQualityMonitor.getQualityReport()
          }
        });
    }
  } catch (error) {
    console.error('Quality monitoring API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get quality monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 