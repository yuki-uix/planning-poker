# WebSocket + HTTP 混合连接技术方案

## 🎯 方案概述

为了解决当用户数量达到4个人后session全体失效的问题，我们提供了一个**WebSocket + HTTP轮询混合连接方案**，确保连接的稳定性和可靠性。

## 🔧 技术架构

### 1. 连接层级

```
┌─────────────────────────────────────────────────────────────┐
│                    混合连接管理器                              │
│  ConnectionManager                                          │
├─────────────────────────────────────────────────────────────┤
│  WebSocket (优先)  │  HTTP轮询 (降级)                        │
│  ┌─────────────┐  │  ┌─────────────┐                        │
│  │ WebSocket   │  │  │ HTTP Poll   │                        │
│  │ Client      │  │  │ Client      │                        │
│  └─────────────┘  │  └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 2. 核心组件

#### WebSocket客户端 (`lib/websocket-client.ts`)
- **自动重连机制**: 指数退避重连策略
- **心跳保活**: 30秒心跳间隔，确保连接活跃
- **消息队列**: 连接断开时缓存消息，重连后自动发送
- **错误处理**: 完善的错误处理和日志记录

#### 混合连接管理器 (`lib/connection-manager.ts`)
- **智能降级**: WebSocket失败时自动切换到HTTP轮询
- **连接监控**: 实时监控连接状态和质量
- **统一接口**: 提供统一的消息发送接口
- **状态同步**: 保持连接状态的一致性

#### React Hook (`hooks/use-connection-manager.ts`)
- **声明式API**: 简单的React Hook接口
- **状态管理**: 自动管理连接状态
- **生命周期**: 组件挂载/卸载时自动连接/断开

## 🚀 核心特性

### 1. 自动重连机制

```typescript
// 指数退避重连策略
const delay = Math.min(
  reconnectInterval * Math.pow(2, reconnectAttempts - 1),
  30000 // 最大30秒
);
```

**优势**:
- 避免频繁重连对服务器造成压力
- 在网络不稳定时提供更好的恢复能力
- 最大重连间隔限制，确保及时恢复

### 2. 智能降级策略

```typescript
// WebSocket连接失败时自动降级到HTTP轮询
try {
  await this.connectWebSocket();
} catch (error) {
  console.log('WebSocket connection failed, falling back to HTTP polling');
  this.fallbackToHttp();
}
```

**优势**:
- 确保在各种网络环境下都能保持连接
- 提供无缝的用户体验
- 自动恢复WebSocket连接

### 3. 消息队列机制

```typescript
// 连接断开时缓存消息
if (this.ws?.readyState === WebSocket.OPEN) {
  this.ws.send(JSON.stringify(fullMessage));
} else {
  this.messageQueue.push(fullMessage);
  console.log('Message queued, waiting for reconnection');
}
```

**优势**:
- 确保消息不丢失
- 重连后自动发送缓存的消息
- 提供可靠的消息传递

### 4. 心跳保活机制

```typescript
// 30秒心跳间隔
private startHeartbeat(): void {
  this.heartbeatTimer = setInterval(() => {
    this.send({
      type: 'heartbeat',
      sessionId: this.config.sessionId,
      userId: this.config.userId
    });
  }, 30000);
}
```

**优势**:
- 及时检测连接状态
- 防止因网络超时导致的连接断开
- 提供连接质量监控

## 📊 性能优化

### 1. 连接池管理

- **会话级连接**: 每个会话维护独立的连接池
- **用户级映射**: 快速定位用户连接
- **自动清理**: 断开连接时自动清理资源

### 2. 消息优化

- **JSON序列化**: 高效的消息序列化
- **批量处理**: 支持批量消息处理
- **压缩传输**: 可选的GZIP压缩

### 3. 内存管理

- **定时清理**: 定期清理无效连接
- **引用计数**: 防止内存泄漏
- **垃圾回收**: 及时释放不用的资源

## 🔄 使用方式

### 1. 在React组件中使用

```typescript
import { useConnectionManager } from '@/hooks/use-connection-manager';

function EstimationTool() {
  const {
    isConnected,
    connectionType,
    sendVote,
    sendReveal,
    sendReset
  } = useConnectionManager({
    sessionId: 'session-123',
    userId: 'user-456',
    onSessionUpdate: (session) => {
      // 处理会话更新
      setSession(session);
    },
    onConnect: () => {
      console.log('连接建立');
    },
    onDisconnect: () => {
      console.log('连接断开');
    }
  });

  const handleVote = (vote: string) => {
    sendVote(vote);
  };

  return (
    <div>
      <div>连接状态: {isConnected ? '已连接' : '未连接'}</div>
      <div>连接类型: {connectionType}</div>
      {/* 其他UI组件 */}
    </div>
  );
}
```

### 2. 直接使用连接管理器

```typescript
import { ConnectionManager } from '@/lib/connection-manager';

const manager = new ConnectionManager({
  sessionId: 'session-123',
  userId: 'user-456',
  websocketUrl: 'ws://localhost:3000/api/websocket'
});

manager.onSessionUpdate((session) => {
  console.log('会话更新:', session);
});

await manager.connect();
```

## 🛡️ 错误处理

### 1. 网络错误处理

```typescript
// 自动重试机制
if (this.state.reconnectAttempts < this.config.maxReconnectAttempts!) {
  this.state.reconnectAttempts++;
  setTimeout(() => {
    this.connectWebSocket().catch(() => {
      // WebSocket连接失败，继续HTTP轮询
    });
  }, 5000);
}
```

### 2. 消息错误处理

```typescript
// 消息发送失败处理
try {
  this.ws?.send(JSON.stringify(message));
} catch (error) {
  console.error('Failed to send message:', error);
  this.onErrorCallback?.(error);
}
```

### 3. 降级处理

```typescript
// WebSocket失败时降级到HTTP
private fallbackToHttp(): void {
  console.log('Falling back to HTTP polling');
  this.state.connectionType = 'http';
  this.startHttpPolling();
}
```

## 📈 监控和调试

### 1. 连接状态监控

```typescript
// 实时连接状态
const state = manager.getState();
console.log('连接状态:', {
  isConnected: state.isConnected,
  connectionType: state.connectionType,
  lastHeartbeat: state.lastHeartbeat,
  reconnectAttempts: state.reconnectAttempts
});
```

### 2. 性能指标

- **连接成功率**: WebSocket vs HTTP轮询
- **消息延迟**: 实时消息传递延迟
- **重连频率**: 连接稳定性指标
- **错误率**: 各种错误的统计

### 3. 调试工具

```typescript
// 启用调试模式
const manager = new ConnectionManager({
  ...config,
  debug: true // 启用详细日志
});
```

## 🎯 解决的问题

### 1. 原问题分析

**问题**: 当用户数量达到4个人后session全体失效

**原因**:
- 轮询机制在高并发下不稳定
- 心跳超时时间过短（30秒）
- 缺乏自动重连机制
- 没有降级策略

### 2. 解决方案

**WebSocket优先**:
- 实时双向通信
- 减少服务器负载
- 更低的延迟

**HTTP轮询降级**:
- 确保连接可靠性
- 兼容各种网络环境
- 自动恢复机制

**智能重连**:
- 指数退避策略
- 最大重连次数限制
- 连接质量监控

## 🚀 部署建议

### 1. 开发环境

```bash
# 安装依赖
npm install ws @types/ws

# 启动开发服务器
npm run dev
```

### 2. 生产环境

```bash
# 构建应用
npm run build

# 启动生产服务器
npm start
```

### 3. 服务器配置

```nginx
# Nginx WebSocket代理配置
location /api/websocket {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 📝 总结

这个WebSocket + HTTP混合连接方案提供了：

1. **高可靠性**: 自动重连和降级机制
2. **低延迟**: WebSocket实时通信
3. **强兼容性**: HTTP轮询作为备选方案
4. **易维护**: 清晰的架构和完善的错误处理
5. **可扩展**: 支持更多用户和更复杂的场景

通过这个方案，可以有效解决当用户数量增加时连接不稳定的问题，提供更好的用户体验。 