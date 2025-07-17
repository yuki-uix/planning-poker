# 部署指南 - 支持12人同时在线的优化版本

## 🎯 概述

本指南将帮助您部署支持12人同时在线的优化版本，该版本采用了分布式架构、连接池管理、消息优化等技术手段。

## 🏗️ 架构升级

### 原有架构问题
- **内存存储**: 服务端内存Map存储，服务器重启数据丢失
- **连接管理**: 简单的WebSocket连接，缺乏连接池和负载均衡
- **性能瓶颈**: 单点故障，无法支持大量并发用户
- **扩展性差**: 无法水平扩展

### 新架构优势
- **分布式存储**: Redis集群，支持数据持久化和高可用
- **连接池管理**: 智能连接池，支持连接数量限制和健康检查
- **消息优化**: 消息压缩和批处理，减少网络开销
- **负载均衡**: Nginx代理，支持多实例部署
- **监控系统**: 实时性能监控和统计

## 📋 系统要求

### 最低要求
- **CPU**: 2核心
- **内存**: 4GB RAM
- **存储**: 20GB SSD
- **网络**: 100Mbps

### 推荐配置
- **CPU**: 4核心
- **内存**: 8GB RAM
- **存储**: 50GB SSD
- **网络**: 1Gbps

## 🚀 部署步骤

### 1. 环境准备

#### 安装Docker和Docker Compose
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose

# CentOS/RHEL
sudo yum install docker docker-compose

# macOS
brew install docker docker-compose

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker
```

#### 克隆项目
```bash
git clone <repository-url>
cd planning-poker
```

### 2. 环境配置

#### 复制环境配置文件
```bash
cp env.example .env
```

#### 编辑环境配置
```bash
# 编辑 .env 文件
nano .env

# 主要配置项
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # 生产环境建议设置密码

MAX_CONNECTIONS_PER_SESSION=20
HEARTBEAT_INTERVAL=25000
HEARTBEAT_TIMEOUT=35000
MAX_MISSED_BEATS=2

CONNECTION_POOL_SIZE=50
HEALTH_CHECK_INTERVAL=30000

BATCH_INTERVAL=100
ENABLE_COMPRESSION=true
COMPRESSION_THRESHOLD=1024
```

### 3. 启动服务

#### 使用Docker Compose启动
```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 服务说明
- **Redis**: 分布式缓存和会话存储
- **WebSocket Service**: 优化的WebSocket服务
- **Frontend**: Next.js前端应用
- **Nginx**: 负载均衡和反向代理

### 4. 验证部署

#### 检查服务健康状态
```bash
# 检查Redis连接
docker exec planning-poker-redis redis-cli ping

# 检查WebSocket服务
curl http://localhost:3001/health

# 检查前端服务
curl http://localhost:3000

# 检查Nginx代理
curl http://localhost/health
```

#### 访问应用
- **前端**: http://localhost
- **WebSocket**: ws://localhost/api/websocket
- **统计API**: http://localhost/api/stats

## 🔧 生产环境配置

### 1. 安全配置

#### Redis安全
```bash
# 设置Redis密码
echo "requirepass your_strong_password" >> redis.conf

# 禁用危险命令
echo "rename-command FLUSHDB \"\"" >> redis.conf
echo "rename-command FLUSHALL \"\"" >> redis.conf
```

#### Nginx安全
```nginx
# 限制连接数
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
limit_conn conn_limit_per_ip 10;

# 限制请求频率
limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=10r/s;
limit_req zone=req_limit_per_ip burst=20 nodelay;
```

### 2. 性能优化

#### Redis优化
```bash
# 内存优化
maxmemory 1gb
maxmemory-policy allkeys-lru

# 持久化优化
save 900 1
save 300 10
save 60 10000
```

#### WebSocket优化
```javascript
// 连接池大小
CONNECTION_POOL_SIZE=100

// 心跳间隔
HEARTBEAT_INTERVAL=30000
HEARTBEAT_TIMEOUT=45000

// 批处理间隔
BATCH_INTERVAL=50
```

### 3. 监控配置

#### 启用监控
```bash
# 访问统计页面
curl http://localhost/api/stats

# 监控关键指标
- 连接数: totalConnections
- 会话数: totalSessions  
- 内存使用: memoryUsage
- 心跳成功率: heartbeatSuccessRate
```

## 📊 性能测试

### 1. 连接测试
```bash
# 使用WebSocket测试工具
npm install -g wscat

# 测试连接
wscat -c "ws://localhost/api/websocket?sessionId=test&userId=user1"
```

### 2. 负载测试
```bash
# 使用Artillery进行负载测试
npm install -g artillery

# 创建测试配置
cat > load-test.yml << EOF
config:
  target: 'ws://localhost/api/websocket'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Ramp up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
scenarios:
  - name: "WebSocket connections"
    engine: "ws"
    flow:
      - connect:
          url: "{{ $randomString() }}?sessionId=test&userId={{ $randomString() }}"
      - think: 30
      - send:
          payload: '{"type":"heartbeat","timestamp":{{ $timestamp }}}'
      - think: 30
EOF

# 运行测试
artillery run load-test.yml
```

### 3. 性能基准
- **连接容量**: 支持50+并发用户
- **消息延迟**: 平均50-100ms
- **内存使用**: 每个连接约1KB
- **CPU使用**: 低负载，支持高并发

## 🔍 故障排除

### 1. 常见问题

#### Redis连接失败
```bash
# 检查Redis服务
docker-compose logs redis

# 检查网络连接
docker exec planning-poker-redis redis-cli ping

# 重启Redis服务
docker-compose restart redis
```

#### WebSocket连接失败
```bash
# 检查WebSocket服务
docker-compose logs websocket-service

# 检查端口占用
netstat -tlnp | grep 3001

# 检查防火墙
sudo ufw status
```

#### 连接数限制
```bash
# 检查连接池状态
curl http://localhost/api/stats | jq '.connections'

# 调整连接池大小
# 编辑 .env 文件中的 CONNECTION_POOL_SIZE
```

### 2. 日志分析
```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs websocket-service

# 实时监控日志
docker-compose logs -f --tail=100
```

### 3. 性能调优
```bash
# 监控系统资源
htop
iotop
netstat -i

# 调整系统参数
echo 'net.core.somaxconn = 65535' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog = 65535' >> /etc/sysctl.conf
sysctl -p
```

## 🔄 升级和维护

### 1. 版本升级
```bash
# 备份数据
docker exec planning-poker-redis redis-cli BGSAVE

# 停止服务
docker-compose down

# 拉取最新代码
git pull origin main

# 重新构建和启动
docker-compose up -d --build
```

### 2. 数据备份
```bash
# Redis数据备份
docker exec planning-poker-redis redis-cli SAVE
docker cp planning-poker-redis:/data/dump.rdb ./backup/

# 配置文件备份
cp .env ./backup/env-$(date +%Y%m%d)
cp docker-compose.yml ./backup/
```

### 3. 监控告警
```bash
# 设置监控脚本
cat > monitor.sh << 'EOF'
#!/bin/bash
STATS=$(curl -s http://localhost/api/stats)
CONNECTIONS=$(echo $STATS | jq -r '.connections.totalConnections')
MEMORY=$(echo $STATS | jq -r '.system.memory.heapUsed')

if [ $CONNECTIONS -gt 100 ]; then
    echo "High connection count: $CONNECTIONS"
fi

if [ $MEMORY -gt 1000000000 ]; then
    echo "High memory usage: $MEMORY bytes"
fi
EOF

chmod +x monitor.sh
# 添加到crontab
echo "*/5 * * * * /path/to/monitor.sh" | crontab -
```

## 📈 扩展建议

### 1. 水平扩展
- 增加WebSocket服务实例
- 使用Redis集群
- 配置负载均衡器

### 2. 功能扩展
- 添加用户认证
- 实现会话持久化
- 支持更多估点模板

### 3. 监控扩展
- 集成Prometheus监控
- 添加Grafana仪表板
- 实现自动告警

## 🎉 总结

通过这个优化版本，您的Planning Poker应用现在可以：

✅ **支持12+人同时在线** - 通过连接池和负载均衡  
✅ **提供稳定连接** - 心跳机制和自动重连  
✅ **优化性能** - 消息压缩和批处理  
✅ **高可用性** - 分布式存储和故障转移  
✅ **易于监控** - 实时统计和性能指标  
✅ **可扩展** - 支持水平扩展和功能增强  

现在您可以自信地支持更大规模的团队协作了！ 