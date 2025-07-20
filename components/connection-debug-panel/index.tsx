import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { connectionStabilityMonitor } from '@/lib/connection-stability-monitor';
import { connectionDebugger } from '@/lib/connection-debugger';

interface ConnectionDebugPanelProps {
  sessionId?: string;
  userId?: string;
  isConnected: boolean;
  connectionType: string;
  showQualityMonitoring?: boolean; // 是否显示质量监控
}

interface DebugInfo {
  stability: {
    totalDisconnections: number;
    recentDisconnections: number;
    totalConnections: number;
    failedConnections: number;
    successRate: string;
    averageDisconnectionInterval: number;
    mostCommonReason: string;
    connectionTypeDistribution: Record<string, number>;
    problematicSessions: Array<{
      sessionId: string;
      disconnections: number;
    }>;
  };
  debug: {
    totalConnections: number;
    successfulConnections: number;
    failedConnections: number;
    averageReconnectAttempts: number;
    mostUsedConnectionType: string;
  };
  quality?: {
    quality: {
      totalRequests: number;
      failedRequests: number;
      successRate: number;
      averageLatency: number;
      currentJitter: number;
      connectionStability: number;
      packetLossRate: number;
      qualityReport: {
        overallScore: number;
        recommendation: string;
        suggestedConnectionType: string;
        shouldDegrade: boolean;
        shouldUpgrade: boolean;
      };
    };
    heartbeat: {
      networkQuality: number;
      consecutiveSuccesses: number;
      consecutiveFailures: number;
      successRate: number;
      averageResponseTime: number;
      currentInterval: number;
      currentTimeout: number;
    };
    reconnection: {
      attemptCount: number;
      networkStability: number;
      successRate: number;
      averageResponseTime: number;
      averageDelay: number;
      shouldReconnect: boolean;
    };
  };
  recentLogs: Array<{
    timestamp: number;
    connectionType: string;
    isConnected: boolean;
    error?: string;
  }>;
  currentState: {
    sessionId?: string;
    userId?: string;
    isConnected: boolean;
    connectionType: string;
    timestamp: string;
  };
}

export function ConnectionDebugPanel({
  sessionId,
  userId,
  isConnected,
  connectionType,
  showQualityMonitoring = false
}: ConnectionDebugPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const updateDebugInfo = useCallback(async () => {
    const stabilityReport = connectionStabilityMonitor.getStabilityReport();
    const debugSummary = connectionDebugger.getSummary();
    const debugLog = connectionDebugger.getDebugLog();

    let qualityData = undefined;
    if (showQualityMonitoring) {
      try {
        const response = await fetch('/api/debug/quality');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            qualityData = result.data;
          }
        }
      } catch (error) {
        console.error('Failed to fetch quality data:', error);
      }
    }

    setDebugInfo({
      stability: stabilityReport,
      debug: debugSummary,
      quality: qualityData,
      recentLogs: debugLog.slice(-10), // 最近10条日志
      currentState: {
        sessionId,
        userId,
        isConnected,
        connectionType,
        timestamp: new Date().toISOString()
      }
    });
    setLastUpdate(new Date());
  }, [sessionId, userId, isConnected, connectionType, showQualityMonitoring]);

  useEffect(() => {
    if (isVisible) {
      updateDebugInfo();
      const interval = setInterval(updateDebugInfo, 5000); // 每5秒更新
      return () => clearInterval(interval);
    }
  }, [isVisible, updateDebugInfo]);

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        🔧 Debug
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-y-auto">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">连接调试面板</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "已连接" : "已断开"}
              </Badge>
              <Badge variant="outline">{connectionType}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
              >
                ✕
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 当前状态 */}
          <div>
            <h4 className="text-sm font-medium mb-2">当前状态</h4>
            <div className="text-xs space-y-1">
              <div>会话ID: {sessionId || 'N/A'}</div>
              <div>用户ID: {userId || 'N/A'}</div>
              <div>连接类型: {connectionType}</div>
              <div>状态: {isConnected ? '已连接' : '已断开'}</div>
              <div>更新时间: {lastUpdate.toLocaleTimeString()}</div>
            </div>
          </div>

          {/* 稳定性统计 */}
          {debugInfo?.stability && (
            <div>
              <h4 className="text-sm font-medium mb-2">稳定性统计</h4>
              <div className="text-xs space-y-1">
                <div>总断开次数: {debugInfo.stability.totalDisconnections}</div>
                <div>最近断开次数: {debugInfo.stability.recentDisconnections}</div>
                <div>成功率: {debugInfo.stability.successRate}%</div>
                <div>平均断开间隔: {Math.round(debugInfo.stability.averageDisconnectionInterval / 1000)}s</div>
                <div>最常见原因: {debugInfo.stability.mostCommonReason}</div>
              </div>
            </div>
          )}

          {/* 连接类型分布 */}
          {debugInfo?.stability?.connectionTypeDistribution && (
            <div>
              <h4 className="text-sm font-medium mb-2">连接类型分布</h4>
              <div className="text-xs space-y-1">
                {Object.entries(debugInfo.stability.connectionTypeDistribution).map(([type, count]) => (
                  <div key={type}>
                    {type}: {String(count)}次
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 问题会话 */}
          {debugInfo?.stability?.problematicSessions && debugInfo.stability.problematicSessions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-red-600">问题会话</h4>
              <div className="text-xs space-y-1">
                {debugInfo.stability.problematicSessions.map((session) => (
                  <div key={session.sessionId} className="text-red-600">
                    {session.sessionId}: {session.disconnections}次断开
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 质量监控 */}
          {showQualityMonitoring && debugInfo?.quality && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-blue-600">质量监控</h4>
              <div className="text-xs space-y-2">
                {/* 连接质量 */}
                <div className="border-l-2 border-blue-300 pl-2">
                  <div className="font-medium">连接质量</div>
                  <div>成功率: {(debugInfo.quality.quality.successRate * 100).toFixed(1)}%</div>
                  <div>平均延迟: {debugInfo.quality.quality.averageLatency.toFixed(0)}ms</div>
                  <div>抖动: {debugInfo.quality.quality.currentJitter.toFixed(0)}ms</div>
                  <div>稳定性: {(debugInfo.quality.quality.connectionStability * 100).toFixed(1)}%</div>
                  <div>建议: {debugInfo.quality.quality.qualityReport.recommendation}</div>
                </div>

                {/* 心跳状态 */}
                <div className="border-l-2 border-green-300 pl-2">
                  <div className="font-medium">心跳状态</div>
                  <div>网络质量: {(debugInfo.quality.heartbeat.networkQuality * 100).toFixed(1)}%</div>
                  <div>连续成功: {debugInfo.quality.heartbeat.consecutiveSuccesses}</div>
                  <div>连续失败: {debugInfo.quality.heartbeat.consecutiveFailures}</div>
                  <div>心跳间隔: {debugInfo.quality.heartbeat.currentInterval}ms</div>
                  <div>超时时间: {debugInfo.quality.heartbeat.currentTimeout}ms</div>
                </div>

                {/* 重连状态 */}
                <div className="border-l-2 border-orange-300 pl-2">
                  <div className="font-medium">重连状态</div>
                  <div>尝试次数: {debugInfo.quality.reconnection.attemptCount}</div>
                  <div>网络稳定性: {(debugInfo.quality.reconnection.networkStability * 100).toFixed(1)}%</div>
                  <div>重连成功率: {(debugInfo.quality.reconnection.successRate * 100).toFixed(1)}%</div>
                  <div>平均延迟: {debugInfo.quality.reconnection.averageResponseTime.toFixed(0)}ms</div>
                  <div>建议连接: {debugInfo.quality.quality.qualityReport.suggestedConnectionType}</div>
                </div>
              </div>
            </div>
          )}

          {/* 最近日志 */}
          {debugInfo?.recentLogs && debugInfo.recentLogs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">最近日志</h4>
              <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
                {debugInfo.recentLogs.map((log, index: number) => (
                  <div key={index} className="border-l-2 border-gray-300 pl-2">
                    <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                    <div className="text-gray-600">{log.connectionType} - {log.isConnected ? '连接' : '断开'}</div>
                    {log.error && <div className="text-red-600">{log.error}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                connectionStabilityMonitor.clearHistory();
                connectionDebugger.clear();
                updateDebugInfo();
              }}
            >
              清除历史
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const debugData = connectionDebugger.exportDebugInfo();
                navigator.clipboard.writeText(debugData);
              }}
            >
              导出数据
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 