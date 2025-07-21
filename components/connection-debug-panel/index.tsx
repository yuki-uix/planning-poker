import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { connectionStabilityMonitor } from '@/lib/connection-stability-monitor';

interface ConnectionDebugPanelProps {
  sessionId?: string;
  userId?: string;
  isConnected: boolean;
  connectionType: string;
}

interface DebugInfo {
  stability: {
    totalDisconnections: number;
    recentDisconnections: number;
    totalConnectionAttempts: number;
    recentSuccessfulConnections: number;
    averageDisconnectionInterval: number;
  };
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
  connectionType
}: ConnectionDebugPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const updateDebugInfo = useCallback(async () => {
    try {
      // 获取稳定性报告
      const stabilityResponse = await fetch('/api/debug/stability');
      const stabilityData = await stabilityResponse.json();

      setDebugInfo({
        stability: stabilityData.stability,
        currentState: {
          sessionId,
          userId,
          isConnected,
          connectionType,
          timestamp: new Date().toISOString()
        }
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to update debug info:', error);
    }
  }, [sessionId, userId, isConnected, connectionType]);

  useEffect(() => {
    if (isVisible) {
      updateDebugInfo();
      const interval = setInterval(updateDebugInfo, 10000); // 每10秒更新
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
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-80 overflow-y-auto">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">连接调试</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "已连接" : "已断开"}
              </Badge>
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
        <CardContent className="space-y-3">
          {/* 当前状态 */}
          <div>
            <h4 className="text-sm font-medium mb-1">当前状态</h4>
            <div className="text-xs space-y-1">
              <div>连接类型: {connectionType}</div>
              <div>状态: {isConnected ? '已连接' : '已断开'}</div>
              <div>更新时间: {lastUpdate.toLocaleTimeString()}</div>
            </div>
          </div>

          {/* 稳定性统计 */}
          {debugInfo?.stability && (
            <div>
              <h4 className="text-sm font-medium mb-1">稳定性统计</h4>
              <div className="text-xs space-y-1">
                <div>总断开: {debugInfo.stability.totalDisconnections}</div>
                <div>最近断开: {debugInfo.stability.recentDisconnections}</div>
                <div>连接尝试: {debugInfo.stability.totalConnectionAttempts}</div>
                <div>成功连接: {debugInfo.stability.recentSuccessfulConnections}</div>
                <div>平均间隔: {debugInfo.stability.averageDisconnectionInterval}s</div>
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
                updateDebugInfo();
              }}
            >
              清除历史
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={updateDebugInfo}
            >
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 