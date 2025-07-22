# 生产环境不活跃用户问题修复

## 问题描述

在本地环境可以保持长时间在线，但在生产环境（Render）中，用户仍然会被过早清除，导致不活跃用户清理机制失效。

## 根本原因分析

### 1. SSE连接超时问题
- **问题**: 生产环境的SSE连接在5分钟后超时断开
- **影响**: 当SSE断开时，用户可能被错误地标记为不活跃
- **解决方案**: 增加SSE超时时间到10分钟，并添加HTTP轮询作为备用

### 2. 标签页关闭检测在生产环境中的限制
- **问题**: `beforeunload`、`pagehide`、`visibilitychange` 事件在生产环境中可能不可靠
- **影响**: 用户关闭标签页时可能无法正确触发离开逻辑
- **解决方案**: 增加多种事件监听和更长的延迟时间

### 3. 网络连接不稳定
- **问题**: 生产环境的网络延迟和连接中断
- **影响**: 可能导致误判用户状态
- **解决方案**: 添加心跳机制和容错处理

### 4. 环境变量配置问题
- **问题**: 生产环境的超时设置可能不适合实际使用场景
- **影响**: 连接过早断开
- **解决方案**: 优化环境变量配置

## 解决方案

### 1. 优化标签页关闭检测

#### 新增功能
- **用户活动监听**: 监听鼠标、键盘、触摸、滚动等用户活动
- **心跳机制**: 定期发送心跳请求保持会话活跃
- **生产环境适配**: 在生产环境中使用更长的延迟时间（30秒 vs 10秒）
- **详细日志**: 添加详细的调试日志帮助诊断问题

#### 代码实现
```typescript
// 监听用户活动事件
window.addEventListener('mousedown', handleUserActivity);
window.addEventListener('mousemove', handleUserActivity);
window.addEventListener('keydown', handleUserActivity);
window.addEventListener('touchstart', handleUserActivity);
window.addEventListener('scroll', handleUserActivity);
window.addEventListener('click', handleUserActivity);

// 心跳检测
const startHeartbeat = () => {
  heartbeatInterval = setInterval(async () => {
    if (isPageVisible && timeSinceLastActivity > 30000) {
      await userHeartbeat(sessionId, currentUser);
    }
  }, 30000);
};
```

### 2. 优化环境变量配置

#### 生产环境配置优化
```bash
# 增加超时时间
HEARTBEAT_TIMEOUT=60000        # 从45秒增加到60秒
MAX_MISSED_BEATS=5            # 从3次增加到5次
SSE_TIMEOUT=600000            # 从5分钟增加到10分钟

# 保持其他配置
HEARTBEAT_INTERVAL=30000      # 30秒心跳间隔
SSE_HEARTBEAT_INTERVAL=30000  # SSE心跳间隔
```

### 3. 添加心跳API

#### 新增API端点
```typescript
// app/actions.ts
export async function userHeartbeat(sessionId: string, userId: string) {
  try {
    const session = await redisSessionStore.updateUserHeartbeat(sessionId, userId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to update heartbeat" };
  }
}
```

### 4. 改进SSE连接管理

#### 容错处理
- SSE连接断开时不立即离开会话
- 自动回退到HTTP轮询
- 添加详细的连接状态日志

## 测试建议

### 1. 本地测试
```bash
# 启动开发服务器
npm run dev

# 测试场景
1. 创建会话并加入多个用户
2. 关闭标签页，等待10秒后重新打开
3. 切换到其他标签页，等待10秒后切换回来
4. 模拟网络断开重连
```

### 2. 生产环境测试
```bash
# 部署到Render
git push origin main

# 测试场景
1. 创建会话并加入多个用户
2. 关闭标签页，等待30秒后重新打开
3. 切换到其他标签页，等待30秒后切换回来
4. 检查浏览器控制台的调试日志
5. 验证用户是否仍然在会话中
```

### 3. 监控和调试

#### 浏览器控制台日志
- 查看用户活动检测日志
- 查看心跳发送日志
- 查看页面可见性变化日志

#### 服务器日志
- 检查SSE连接状态
- 检查心跳请求
- 检查用户离开事件

## 预期效果

### 改进前
- 用户1分钟不活跃被清除
- 标签页关闭检测不可靠
- 生产环境连接不稳定

### 改进后
- 用户只有在真正离开时才被清除
- 更可靠的标签页关闭检测
- 心跳机制保持会话活跃
- 生产环境适配的延迟时间
- 详细的调试日志

## 部署步骤

1. **更新代码**
   ```bash
   git add .
   git commit -m "fix: optimize inactive user detection for production"
   git push origin main
   ```

2. **更新环境变量**
   - 在Render Dashboard中更新环境变量
   - 确保所有新的环境变量都已设置

3. **重启服务**
   - 在Render Dashboard中重启Web服务
   - 等待部署完成

4. **验证功能**
   - 访问生产环境网站
   - 测试用户离开检测功能
   - 检查控制台日志

## 故障排除

### 如果问题仍然存在

1. **检查环境变量**
   ```bash
   # 在Render Dashboard中验证
   HEARTBEAT_TIMEOUT=60000
   MAX_MISSED_BEATS=5
   SSE_TIMEOUT=600000
   ```

2. **检查浏览器控制台**
   - 查看是否有JavaScript错误
   - 查看用户活动检测日志
   - 查看心跳发送日志

3. **检查服务器日志**
   - 在Render Dashboard中查看日志
   - 检查SSE连接状态
   - 检查心跳请求

4. **网络诊断**
   - 使用浏览器开发者工具检查网络请求
   - 验证SSE连接是否正常建立
   - 检查心跳请求是否成功发送 