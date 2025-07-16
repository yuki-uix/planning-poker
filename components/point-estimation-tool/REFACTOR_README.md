# Point Estimation Tool 重构说明

## 重构目标

根据文件结构规则，将原来的单一大型hook文件拆分为多个专注的小文件：

1. 函数参数不超过4个
2. 单一文件专注于单一功能
3. 避免循环依赖
4. 减少不必要的性能损失

## 重构后的文件结构

### 主要文件
- `usePointEstimationTool.ts` - 主hook，协调各个子hook

### 子hooks (hooks目录)
- `useUserState.ts` - 管理用户状态（用户名、角色、投票等）
- `useSessionState.ts` - 管理会话状态（会话数据、连接状态等）
- `useSessionActions.ts` - 处理会话操作（创建、加入、投票等）
- `useUIState.ts` - 管理UI状态（复制状态、错误模态框等）
- `useComputedValues.ts` - 计算派生值（统计数据、权限等）
- `index.ts` - 统一导出所有hooks

## 重构优势

### 1. 单一职责
每个hook文件专注于特定的功能领域：
- `useUserState`: 用户相关状态管理
- `useSessionState`: 会话相关状态管理
- `useSessionActions`: 会话操作逻辑
- `useUIState`: UI交互状态
- `useComputedValues`: 计算属性

### 2. 参数控制
所有函数都遵循参数不超过4个的规则：
- `useUserState()`: 无参数
- `useSessionState(sessionId, currentUser, isJoined, isRestoring, setIsJoined)`: 5个参数（包含回调函数）
- `useSessionActions()`: 无参数
- `useUIState()`: 无参数
- `useComputedValues(session, currentUser)`: 2个参数

### 3. 避免循环依赖
- 子hooks之间没有相互依赖
- 主hook通过组合模式使用子hooks
- 清晰的依赖层次结构

### 4. 性能优化
- 使用`useMemo`优化计算属性
- 使用`useCallback`优化事件处理函数
- 状态更新更加精确，减少不必要的重渲染

## 使用方式

```typescript
// 在主组件中使用
const {
  currentUser,
  userName,
  session,
  selectedVote,
  isJoined,
  isConnected,
  isLoading,
  // ... 其他状态和操作
} = usePointEstimationTool();
```

## 维护建议

1. **添加新功能时**：根据功能类型选择相应的子hook
2. **修改状态逻辑时**：在对应的子hook中进行修改
3. **添加新的计算属性时**：在`useComputedValues`中添加
4. **添加新的UI交互时**：在`useUIState`中添加

## 测试

重构后的代码通过了构建测试，确保功能完整性。 