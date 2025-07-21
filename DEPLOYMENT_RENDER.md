# Render 部署指南

## 概述
本项目已优化以在Render平台上运行，支持WebSocket和长连接。

## 部署步骤

### 1. 准备代码
确保代码已推送到GitHub仓库。

### 2. 在Render中创建服务
1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击 "New +" → "Web Service"
3. 连接GitHub仓库
4. 选择 `planning-poker` 仓库

### 3. 配置Web服务
- **Name**: `planning-poker`
- **Environment**: `Node`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Plan**: `Starter` ($7/月) 或 `Free`

### 4. 创建Redis服务
1. 点击 "New +" → "Redis"
2. **Name**: `planning-poker-redis`
3. **Plan**: `Free` 或 `Starter`

### 5. 设置环境变量
在Web服务中设置以下环境变量：

```bash
NODE_ENV=production
PORT=3000
REDIS_HOST=your-redis-service.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
MAX_CONNECTIONS_PER_SESSION=20
HEARTBEAT_INTERVAL=30000
HEARTBEAT_TIMEOUT=45000
SSE_TIMEOUT=300000
SSE_HEARTBEAT_INTERVAL=30000
```

### 6. 部署
点击 "Create Web Service" 开始部署。

## 优势
- 原生WebSocket支持
- 5分钟+长连接支持
- 更好的并发性能
- 固定月费成本

## 监控
访问 `/api/health` 检查服务状态。
访问 `/api/debug/stability` 查看连接稳定性。

## 与Vercel的对比

| 特性 | Vercel | Render |
|------|--------|--------|
| WebSocket支持 | ❌ 有限制 | ✅ 原生支持 |
| 连接时长 | 60秒限制 | 5分钟+ |
| 并发连接 | 有限制 | 更高限制 |
| 成本 | 按函数调用 | 固定月费 |
| 部署复杂度 | 简单 | 中等 |

## 故障排除

### 连接不稳定
1. 检查Redis连接配置
2. 查看健康检查端点 `/api/health`
3. 检查Render服务日志

### 部署失败
1. 确保所有依赖都已安装
2. 检查构建命令是否正确
3. 查看构建日志中的错误信息 