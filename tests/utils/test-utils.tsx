import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';

// 自定义渲染器，包含主题提供者
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// 重新导出所有测试库函数
export * from '@testing-library/react';
export { customRender as render };

// Mock函数工具
export const createMockWebSocket = () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

export const createMockConnectionManager = () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
  isConnected: jest.fn(() => false),
  onMessage: jest.fn(),
  onError: jest.fn(),
  onClose: jest.fn(),
});

// 等待函数
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)); 