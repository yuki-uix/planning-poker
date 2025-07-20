# Vercel 部署指南

## 🚀 概述

本指南将帮助你成功部署 Planning Poker 应用到 Vercel 平台。由于 Vercel 是无服务器环境，不支持持久的 WebSocket 连接，我们使用 SSE + HTTP 轮询的混合架构来提供实时通信。

## 📋 前置要求

1. **Vercel 账户**: 在 [vercel.com](https://vercel.com) 注册账户
2. **Git 仓库**: 将代码推送到 GitHub、GitLab 或 Bitbucket
3. **Redis 服务**: 使用外部 Redis 服务（如 Upstash、Redis Cloud 等）

## 🔧 部署步骤

### 1. 准备代码

确保你的代码已经适配了 Vercel 环境：

```bash
# 检查配置
npm run check-prod https://your-vercel-domain.vercel.app

# 本地测试
npm run dev
```

### 2. 连接 Vercel

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 导入你的 Git 仓库
4. 选择 Next.js 框架

### 3. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

#### 必需的环境变量
```bash
NODE_ENV=production
```

#### Redis 配置（使用外部服务）
```bash
# Upstash Redis 示例
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# 或者 Redis Cloud 示例
REDIS_HOST=your-redis-host.redis.cloud
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

#### 连接配置
```bash
MAX_CONNECTIONS_PER_SESSION=20
HEARTBEAT_INTERVAL=25000
HEARTBEAT_TIMEOUT=35000
MAX_MISSED_BEATS=2
CONNECTION_POOL_SIZE=50
HEALTH_CHECK_INTERVAL=30000
```

#### 消息优化配置
```bash
BATCH_INTERVAL=100
ENABLE_COMPRESSION=true
COMPRESSION_THRESHOLD=1024
```

#### SSE 配置
```bash
SSE_ENABLED=true
SSE_TIMEOUT=60000
SSE_HEARTBEAT_INTERVAL=30000
SSE_MAX_CONNECTIONS=100
```

#### 混合连接配置
```bash
HYBRID_CONNECTION_ENABLED=true
PREFERRED_CONNECTION_TYPE=auto
FALLBACK_DELAY=5000
```

### 4. 配置函数超时

Vercel 配置文件 `vercel.json` 已经设置了适当的超时时间：

```json
{
  "functions": {
    "app/api/sse/route.ts": {
      "maxDuration": 30
    },
    "app/api/session/route.ts": {
      "maxDuration": 10
    }
  }
}
```

### 5. 部署

1. 推送代码到 Git 仓库
2. Vercel 会自动检测并部署
3. 等待部署完成

## 🔍 部署后验证

### 1. 运行配置检查

```bash
# 使用你的 Vercel 域名
npm run check-prod https://your-app.vercel.app
```

### 2. 测试连接

```bash
# 测试 SSE 端点
curl -N https://your-app.vercel.app/api/sse?sessionId=test&userId=test

# 测试 HTTP 轮询端点
curl https://your-app.vercel.app/api/session/test

# 测试统计端点
curl https://your-app.vercel.app/api/stats
```

### 3. 检查调试信息

```bash
# 获取连接调试信息
curl https://your-app.vercel.app/api/debug/connection
```

## 🛠️ 故障排除

### 常见问题

#### 1. Redis 连接失败

**症状**: 应用无法连接到 Redis
**解决方案**:
- 检查 Redis 服务是否正常运行
- 验证环境变量配置
- 确保网络连接正常

```bash
# 检查 Redis 连接
redis-cli -h your-redis-host -p 6379 -a your-password ping
```

#### 2. SSE 连接超时

**症状**: SSE 连接在 30 秒后断开
**解决方案**:
- 这是 Vercel 的限制，应用会自动降级到 HTTP 轮询
- 确保 `FALLBACK_DELAY` 设置合理

#### 3. 函数超时

**症状**: API 请求返回超时错误
**解决方案**:
- 检查 `vercel.json` 中的超时设置
- 优化代码执行时间
- 考虑使用 Edge Functions

### 性能优化

#### 1. 启用缓存

```json
{
  "headers": [
    {
      "source": "/api/stats",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=30"
        }
      ]
    }
  ]
}
```

#### 2. 压缩响应

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Encoding",
          "value": "gzip"
        }
      ]
    }
  ]
}
```

## 📊 监控和日志

### 1. Vercel 日志

在 Vercel Dashboard 中查看：
- 函数执行日志
- 错误日志
- 性能指标

### 2. 应用监控

使用内置的监控端点：

```bash
# 获取系统统计
curl https://your-app.vercel.app/api/stats

# 获取性能指标
curl https://your-app.vercel.app/api/stats?category=performance
```

### 3. 连接调试

```bash
# 获取连接调试信息
curl https://your-app.vercel.app/api/debug/connection

# 清除调试日志
curl -X POST https://your-app.vercel.app/api/debug/connection \
  -H "Content-Type: application/json" \
  -d '{"action": "clear"}'
```

## 🔄 持续部署

### 1. 自动部署

Vercel 支持自动部署：
- 推送到 `main` 分支自动部署到生产环境
- 创建 Pull Request 自动部署到预览环境

### 2. 环境管理

```bash
# 开发环境
vercel --env NODE_ENV=development

# 生产环境
vercel --prod --env NODE_ENV=production
```

### 3. 回滚

在 Vercel Dashboard 中可以轻松回滚到之前的部署版本。

## 🎯 最佳实践

### 1. 环境变量管理

- 使用 Vercel 的环境变量功能
- 不同环境使用不同的变量
- 敏感信息使用 Vercel 的加密功能

### 2. 性能优化

- 启用 Vercel 的自动优化
- 使用 Edge Functions 处理简单请求
- 合理设置缓存策略

### 3. 安全考虑

- 使用 HTTPS
- 设置适当的 CORS 策略
- 验证用户输入

### 4. 监控告警

- 设置错误率告警
- 监控响应时间
- 跟踪用户活跃度

## 📞 支持

如果遇到问题：

1. 查看 [Vercel 文档](https://vercel.com/docs)
2. 检查应用日志
3. 运行配置检查脚本
4. 联系技术支持

## 🎉 部署完成

恭喜！你的 Planning Poker 应用已经成功部署到 Vercel。现在可以：

- 分享应用链接给团队成员
- 开始使用实时协作功能
- 监控应用性能
- 根据需要进行优化 