# 测试结构说明

## 目录结构

```
tests/
├── jest.config.js          # Jest配置文件
├── setup.ts               # 测试环境设置
├── utils/
│   └── test-utils.tsx     # 测试工具函数
├── hooks/                 # Hook测试文件
│   └── use-mobile.test.tsx
└── README.md             # 本文件
```

## 运行测试

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 测试工具

### test-utils.tsx
提供了通用的测试工具函数：
- `render`: 自定义渲染器，包含主题提供者
- `createMockWebSocket`: 创建WebSocket mock
- `createMockConnectionManager`: 创建连接管理器mock
- `waitFor`: 异步等待函数

### setup.ts
配置全局测试环境：
- 设置Jest DOM匹配器
- Mock浏览器API (matchMedia, ResizeObserver, IntersectionObserver, WebSocket)
- 全局清理函数

## 编写Hook测试

### 基本结构
```typescript
import { renderHook } from '@testing-library/react';
import { useYourHook } from '../../hooks/use-your-hook';

describe('useYourHook', () => {
  beforeEach(() => {
    // 设置测试环境
  });

  it('应该正确返回初始状态', () => {
    const { result } = renderHook(() => useYourHook());
    expect(result.current).toBe(expectedValue);
  });

  it('应该正确处理状态变化', () => {
    const { result, rerender } = renderHook(() => useYourHook());
    // 测试逻辑
  });
});
```

### 测试异步Hook
```typescript
import { renderHook, waitFor } from '@testing-library/react';

it('应该处理异步操作', async () => {
  const { result } = renderHook(() => useAsyncHook());
  
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
  
  expect(result.current.data).toBeDefined();
});
```

## 可用的Hooks

以下hooks可以添加测试：

1. `hooks/use-mobile.tsx` - 移动设备检测
2. `hooks/use-language.tsx` - 语言切换
3. `hooks/use-toast.ts` - 消息提示
4. `hooks/use-websocket.ts` - WebSocket连接
5. `hooks/use-connection-manager.ts` - 连接管理

## 注意事项

- 使用`renderHook`来测试hooks
- 正确mock浏览器API和外部依赖
- 测试hook的初始状态、状态变化和清理逻辑
- 对于异步hooks，使用`waitFor`等待状态更新 