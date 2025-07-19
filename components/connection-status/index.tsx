import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, Globe, Zap } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  connectionType: 'sse' | 'websocket' | 'http' | 'disconnected';
  lastHeartbeat?: number;
  reconnectAttempts?: number;
  className?: string;
}

export function ConnectionStatus({
  isConnected,
  connectionType,
  lastHeartbeat,
  reconnectAttempts,
  className = ''
}: ConnectionStatusProps) {
  const getConnectionIcon = () => {
    if (!isConnected) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }

    switch (connectionType) {
      case 'sse':
        return <Zap className="h-4 w-4 text-green-500" />;
      case 'websocket':
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'http':
        return <Globe className="h-4 w-4 text-yellow-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionText = () => {
    if (!isConnected) {
      return '连接断开';
    }

    switch (connectionType) {
      case 'sse':
        return 'SSE连接';
      case 'websocket':
        return 'WebSocket连接';
      case 'http':
        return 'HTTP轮询';
      default:
        return '未连接';
    }
  };

  const getConnectionColor = () => {
    if (!isConnected) {
      return 'bg-red-100 text-red-800 border-red-200';
    }

    switch (connectionType) {
      case 'sse':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'websocket':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'http':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConnectionDescription = () => {
    if (!isConnected) {
      return '连接已断开，正在尝试重新连接...';
    }

    const descriptions: Record<string, string> = {
      sse: 'Server-Sent Events连接，提供实时数据推送',
      websocket: 'WebSocket连接，提供双向实时通信',
      http: 'HTTP轮询连接，定期获取数据更新'
    };

    return descriptions[connectionType] || '未知连接类型';
  };

  const getLatencyText = () => {
    if (!lastHeartbeat) return '未知';
    
    const latency = Date.now() - lastHeartbeat;
    if (latency < 1000) return '< 1s';
    if (latency < 5000) return '< 5s';
    if (latency < 10000) return '< 10s';
    return '> 10s';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 ${className}`}>
            <Badge 
              variant="outline" 
              className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${getConnectionColor()}`}
            >
              {getConnectionIcon()}
              <span>{getConnectionText()}</span>
              {reconnectAttempts && reconnectAttempts > 0 && (
                <span className="text-xs opacity-75">({reconnectAttempts})</span>
              )}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{getConnectionDescription()}</p>
            {isConnected && (
              <div className="text-xs text-gray-600 space-y-0.5">
                <p>延迟: {getLatencyText()}</p>
                {reconnectAttempts && reconnectAttempts > 0 && (
                  <p>重连次数: {reconnectAttempts}</p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 