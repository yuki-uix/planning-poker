# 持久化存储机制说明

## 概述

为了解决用户在执行 `reveal`、`reset`、`edit template` 操作后刷新页面导致用户信息丢失的问题，我们实现了一个更稳定的持久化存储机制。

## 主要改进

### 1. 新的持久化存储系统 (`lib/persistence.ts`)

- **数据版本控制**: 支持数据版本管理，便于后续升级
- **错误处理和重试机制**: 自动重试失败的存储操作
- **数据验证**: 严格的数据格式验证，防止损坏数据
- **备份机制**: 自动创建数据备份，提高数据安全性
- **过期清理**: 自动清理过期数据，节省存储空间

### 2. 改进的用户状态恢复

- **智能恢复**: 页面加载时自动恢复用户状态
- **投票状态恢复**: 自动恢复用户的投票状态
- **会话状态同步**: 确保本地状态与服务器状态同步
- **错误恢复**: 当恢复失败时，优雅地降级到登录界面

### 3. 实时状态同步

- **投票同步**: 用户投票后立即更新本地存储
- **会话状态同步**: 会话状态变化时自动更新本地存储
- **模板设置同步**: 模板设置变化时自动保存

## 核心功能

### 数据存储

```typescript
// 保存用户数据
await saveUserData({
  userId: "user-123",
  userName: "张三",
  sessionId: "session-456",
  role: "host",
  lastVote: "8",
  lastSessionState: {
    revealed: false,
    template: {
      type: "fibonacci",
      customCards: "☕️,1,2,3,5,8,13",
    },
  },
});
```

### 数据恢复

```typescript
// 获取用户数据
const userData = await getUserData();
if (userData) {
  // 自动恢复用户状态
  setCurrentUser(userData.userId);
  setUserName(userData.userName);
  setSessionId(userData.sessionId);
  setSelectedRole(userData.role);
  setSelectedVote(userData.lastVote);
}
```

### 增量更新

```typescript
// 更新用户投票
await updateUserVote("13");

// 更新会话状态
await updateSessionState(sessionId, {
  revealed: true,
  template: {
    type: "custom",
    customCards: "1,2,3,5,8,13,21",
  },
});
```

## 存储结构

### 用户数据 (`estimation_tool_user_info_v2`)

```json
{
  "userId": "user-123",
  "userName": "张三",
  "sessionId": "session-456",
  "role": "host",
  "timestamp": 1703123456789,
  "lastVote": "8",
  "lastSessionState": {
    "revealed": false,
    "template": {
      "type": "fibonacci",
      "customCards": "☕️,1,2,3,5,8,13"
    }
  },
  "version": "2.0.0"
}
```

### 会话状态 (`estimation_tool_session_state_v2`)

```json
{
  "sessionId": "session-456",
  "state": {
    "revealed": false,
    "template": {
      "type": "fibonacci",
      "customCards": "☕️,1,2,3,5,8,13"
    }
  },
  "timestamp": 1703123456789,
  "version": "2.0.0"
}
```

### 备份数据 (`estimation_tool_backup_v2`)

备份数据与用户数据格式相同，用于数据恢复。

## 数据迁移

系统会自动从旧版本存储迁移数据到新版本：

```typescript
// 自动迁移旧版本数据
await migrateFromOldStorage();
```

## 错误处理

### 存储失败重试

```typescript
// 自动重试失败的存储操作
await withRetry(() => {
  localStorage.setItem(key, JSON.stringify(data));
}, 3); // 最多重试3次
```

### 数据验证

```typescript
// 验证数据格式
if (!validateData(parsed)) {
  console.warn("Invalid data format, clearing storage");
  clearAllData();
  return null;
}
```

### 过期数据清理

```typescript
// 自动清理过期数据
if (isDataExpired(parsed.timestamp)) {
  console.log("Data expired, clearing storage");
  clearAllData();
  return null;
}
```

## 使用场景

### 1. 页面刷新后恢复状态

用户刷新页面后，系统会自动：

1. 检查本地存储的用户数据
2. 验证数据有效性
3. 恢复用户状态和会话信息
4. 同步服务器端状态

### 2. 投票状态持久化

用户投票后：

1. 立即更新本地存储
2. 发送投票到服务器
3. 如果服务器失败，恢复本地状态

### 3. 会话操作状态同步

执行 `reveal`、`reset`、`edit template` 操作后：

1. 更新服务器状态
2. 同步更新本地存储
3. 确保页面刷新后状态一致

## 测试

可以使用测试页面验证存储功能：

```bash
# 访问测试页面
http://localhost:3000/test-storage
```

测试页面提供以下功能：

- 保存测试数据
- 加载和验证数据
- 测试增量更新
- 测试数据迁移
- 查看存储信息

## 性能优化

### 存储空间管理

- 自动清理过期数据（24 小时）
- 压缩存储数据
- 监控存储使用情况

### 操作优化

- 异步存储操作
- 批量更新减少存储次数
- 智能缓存机制

## 兼容性

- 支持现代浏览器的 localStorage
- 自动检测存储可用性
- 优雅降级处理

## 故障排除

### 常见问题

1. **数据丢失**: 检查浏览器存储权限和空间
2. **恢复失败**: 查看控制台错误信息
3. **状态不同步**: 手动清除存储后重新登录

### 调试工具

```typescript
// 获取存储信息
const info = getStorageInfo();
console.log("Storage info:", info);

// 清除所有数据
clearAllData();
```

## 未来改进

1. **服务器端持久化**: 考虑使用数据库存储会话数据
2. **实时同步**: 实现 WebSocket 实时同步
3. **离线支持**: 添加离线模式支持
4. **数据加密**: 对敏感数据进行加密存储
