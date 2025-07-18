# WebSocket优化部署指南

## 概述

本文档提供了部署优化后的WebSocket服务的详细步骤，包括环境配置、性能调优和监控设置。

## 部署步骤

### 1. 环境准备

#### 系统要求
- Node.js 18+
- Redis 6.0+
- Docker & Docker Compose (推荐)
- Nginx (生产环境)

#### 环境变量配置
```bash
# .env 文件
REDIS_URL=redis://localhost:6379
PORT=3001
MAX_CONNECTIONS_PER_SESSION=20
NODE_ENV=production
```

### 2. 代码更新

#### 更新文件列表
- `lib/heartbeat-manager.ts` - 智能心跳管理器
- `lib/websocket-client.ts` - 增强的WebSocket客户端
- `lib/connection-pool.ts` - 优化的连接池
- `websocket-server.ts` - 更新的WebSocket服务器
- `nginx.conf` - 优化的Nginx配置

#### 验证更新
```bash
# 检查文件是否正确更新
git status
git diff

# 运行类型检查
npm run lint
```

### 3. 服务部署

#### 使用Docker Compose (推荐)
```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f websocket-service
```

#### 手动部署
```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动WebSocket服务器
npm run websocket

# 启动前端服务
npm start
```

### 4. Nginx配置更新

#### 更新Nginx配置
```bash
# 备份原配置
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# 更新配置
sudo cp nginx.conf /etc/nginx/nginx.conf

# 测试配置
sudo nginx -t

# 重新加载配置
sudo nginx -s reload
```

#### 关键配置项
- 工作连接数：2048
- 事件模型：epoll
- WebSocket超时：300秒
- 限流配置：10r/s (WebSocket), 30r/s (API)

### 5. 性能测试

#### 运行连接稳定性测试
```bash
# 本地测试 (8个连接，60秒)
npm run test:websocket:local

# 自定义测试
npm run test:websocket ws://your-server:3001 120000 12 15000
```

#### 测试参数说明
- URL: WebSocket服务器地址
- 测试时长: 毫秒
- 连接数: 并发连接数
- 心跳间隔: 毫秒

#### 预期测试结果
- 连接成功率: >95%
- 心跳成功率: >98%
- 平均延迟: <100ms
- 重连成功率: >80%

### 6. 监控配置

#### 健康检查端点
```bash
# 检查服务状态
curl http://your-server/health

# 预期响应
healthy
```

#### 日志监控
```bash
# 查看Nginx访问日志
tail -f /var/log/nginx/access.log

# 查看WebSocket服务器日志
docker logs -f websocket-service

# 查看错误日志
tail -f /var/log/nginx/error.log
```

#### 关键监控指标
- 连接数统计
- 心跳成功率
- 平均响应时间
- 错误率统计

### 7. 性能调优

#### 系统级优化
```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 优化TCP参数
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65535" >> /etc/sysctl.conf
sysctl -p
```

#### Redis优化
```bash
# Redis配置优化
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 8. 故障排除

#### 常见问题

1. **连接数限制**
```bash
# 检查连接数限制
ulimit -n

# 临时增加限制
ulimit -n 65536
```

2. **内存不足**
```bash
# 检查内存使用
free -h

# 检查Redis内存
redis-cli info memory
```

3. **网络超时**
```bash
# 检查网络连接
ping your-server

# 检查端口开放
telnet your-server 3001
```

#### 调试命令
```bash
# 查看WebSocket连接状态
netstat -an | grep :3001

# 查看Nginx进程
ps aux | grep nginx

# 查看系统资源
htop
```

### 9. 回滚计划

#### 快速回滚
```bash
# 回滚Nginx配置
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
sudo nginx -s reload

# 回滚代码
git checkout HEAD~1
npm install
npm run build
docker-compose restart
```

#### 配置回滚
```bash
# 恢复原始心跳配置
# 在 heartbeat-manager.ts 中修改配置
{
  interval: 25000,        // 恢复25秒
  timeout: 35000,         // 恢复35秒
  maxMissedBeats: 2,      // 恢复2次
  adaptiveInterval: false // 禁用自适应
}
```

### 10. 验证清单

#### 部署前检查
- [ ] 代码更新完成
- [ ] 环境变量配置正确
- [ ] 依赖安装完成
- [ ] 配置文件备份

#### 部署后验证
- [ ] 服务启动成功
- [ ] 健康检查通过
- [ ] 连接测试通过
- [ ] 性能测试达标
- [ ] 监控正常

#### 生产环境检查
- [ ] 日志记录正常
- [ ] 错误率在可接受范围
- [ ] 响应时间满足要求
- [ ] 资源使用合理

## 总结

通过以上步骤，您可以成功部署优化后的WebSocket服务。建议在生产环境中逐步部署，并密切监控关键指标，确保服务稳定运行。

如果遇到问题，请参考故障排除部分或查看详细的技术文档 [WEBSOCKET_OPTIMIZATION.md](./WEBSOCKET_OPTIMIZATION.md)。 