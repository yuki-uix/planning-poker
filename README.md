# Point Estimation Tool / 估点工具

<div align="center">

[English](#english) | [中文](#中文)

</div>

---

<div id="english">

# Point Estimation Tool

A collaborative planning poker tool with multi-language interface and multiple estimation templates.

## 🌍 Multi-language Support

This application supports both Chinese and English:

- **Auto-detection**: The app automatically detects browser language settings
- **Manual switching**: Users can switch between Chinese and English anytime via the language toggle button
- **Memory function**: User's language preference is saved in local storage

### Supported Languages

- 🇨🇳 **Chinese (zh)**: Complete Chinese interface
- 🇺🇸 **English (en)**: Complete English interface

## 🎯 Estimation Templates

The app provides multiple preset estimation templates:

### 1. Fibonacci Sequence

Classic agile estimation sequence

```
☕️, 0.5, 1, 2, 3, 5, 8, 13, 21
```

### 2. Natural Numbers

Simple 1-10 natural number sequence

```
☕️, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
```

### 3. Custom

Users can input completely custom estimation values separated by commas

## 🚀 Features

- **Real-time collaboration**: Multi-user real-time voting and result display
- **Template management**: Flexible estimation template selection and customization
- **Multi-language interface**: Chinese-English bilingual support
- **Responsive design**: Adapts to various screen sizes
- **Connection status**: Real-time connection status display
- **Voting statistics**: Detailed vote distribution and team estimation

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **State Management**: React Hooks
- **Internationalization**: Custom i18n solution

## 📦 Installation and Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## 🎨 Interface Screenshots

### Login Interface

- Supports Chinese-English switching
- Auto-detects browser language
- Clean user experience

### Main Interface

- Real-time voting status
- Template settings panel
- Voting result statistics

## 🔧 Development Guide

### Adding New Languages

1. Add new language configuration in `lib/i18n.ts`
2. Update the `Language` type definition
3. Add language detection logic in the `detectLanguage` function

### Adding New Translations

1. Add new translation keys in the `Translations` interface
2. Add corresponding translation text in all language configurations

### Using Translations

```typescript
import { useLanguage } from "@/hooks/use-language";

function MyComponent() {
  const { t, language, toggleLanguage } = useLanguage();

  return (
    <div>
      <h1>{t.login.title}</h1>
      <button onClick={toggleLanguage}>Switch Language</button>
    </div>
  );
}
```

## 📝 License

MIT License

</div>

---

<div id="中文">

# 估点工具

一个协作式的规划扑克工具，支持多语言界面和多种估点模板。

## 🌍 多语言支持

本应用支持中文和英文两种语言：

- **自动检测**: 应用会自动检测浏览器的语言设置
- **手动切换**: 用户可以随时通过界面上的语言切换按钮在中英文之间切换
- **记忆功能**: 用户的语言偏好会保存在本地存储中

### 支持的语言

- 🇨🇳 **中文 (zh)**: 完整的中文界面
- 🇺🇸 **英文 (en)**: 完整的英文界面

## 🎯 估点模板

应用提供多种预设的估点模板：

### 1. 菲波那契数列 (Fibonacci Sequence)

经典的敏捷估点序列

```
☕️, 0.5, 1, 2, 3, 5, 8, 13, 21
```

### 2. 自然数 (Natural Numbers)

简单的 1-10 自然数序列

```
☕️, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
```

### 3. 自定义 (Custom)

用户可以输入完全自定义的估点值，用逗号分隔

## 🚀 功能特性

- **实时协作**: 多用户实时投票和结果展示
- **模板管理**: 灵活的估点模板选择和自定义
- **多语言界面**: 中英文双语支持
- **响应式设计**: 适配各种屏幕尺寸
- **连接状态**: 实时显示连接状态
- **投票统计**: 详细的投票分布和团队估点

## 🛠️ 技术栈

- **前端**: Next.js 15, React 19, TypeScript
- **样式**: Tailwind CSS, shadcn/ui
- **状态管理**: React Hooks
- **国际化**: 自定义 i18n 解决方案

## 📦 安装和运行

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

## 🎨 界面截图

### 登录界面

- 支持中英文切换
- 自动检测浏览器语言
- 简洁的用户体验

### 主界面

- 实时投票状态
- 模板设置面板
- 投票结果统计

## 🔧 开发说明

### 添加新语言

1. 在 `lib/i18n.ts` 中添加新的语言配置
2. 更新 `Language` 类型定义
3. 在 `detectLanguage` 函数中添加语言检测逻辑

### 添加新翻译

1. 在 `Translations` 接口中添加新的翻译键
2. 在所有语言配置中添加对应的翻译文本

### 使用翻译

```typescript
import { useLanguage } from "@/hooks/use-language";

function MyComponent() {
  const { t, language, toggleLanguage } = useLanguage();

  return (
    <div>
      <h1>{t.login.title}</h1>
      <button onClick={toggleLanguage}>切换语言</button>
    </div>
  );
}
```

## 📝 许可证

MIT License

</div>
