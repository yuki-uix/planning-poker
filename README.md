# 估点工具 / Point Estimation Tool

[English](#english) | [中文](#chinese)

---

## English

A real-time collaborative point estimation tool for agile teams, supporting planning poker sessions with role-based access control.

### Features

- **High-Performance Real-time Collaboration**: Supports 12+ users simultaneously with optimized WebSocket connections
- **Distributed Architecture**: Redis-based session storage for high availability and scalability
- **Role-based Access Control**: Three distinct roles with different permissions
  - **Host**: Create sessions, manage templates, control voting flow
  - **Attendance**: Join sessions and participate in voting
  - **Guest**: Observe sessions without voting
- **Multiple Estimation Templates**: Fibonacci, Natural Numbers, Custom values
- **Bilingual Support**: Chinese and English interface
- **Theme Color Customization**: Four beautiful theme colors to choose from
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live session updates and user status
- **Connection Pool Management**: Intelligent connection pooling with health checks
- **Message Optimization**: Compression and batching for improved performance
- **Load Balancing**: Nginx-based load balancing for horizontal scaling
- **Performance Monitoring**: Real-time statistics and performance metrics

### Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **State Management**: Redis distributed storage
- **Real-time**: WebSocket + HTTP hybrid connection
- **Backend**: Node.js, Redis, WebSocket
- **Deployment**: Docker, Nginx, Load Balancing

### Getting Started

#### Prerequisites

- Node.js 18+
- npm or yarn
- Redis (for production)
- Docker (optional, for containerized deployment)

#### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd estimation-tool
```

2. Install dependencies

```bash
npm install
```

3. Run the development server

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

#### Production Deployment

For production deployment with support for 12+ concurrent users:

```bash
# Using Docker Compose
docker-compose up -d

# Or manual deployment
npm run build
npm start
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

#### Usage

1. **Create a Session (Host)**:

   - Enter your name and session ID
   - Select "Host" role
   - Click "Create Session"

2. **Join as Participant**:

   - Enter your name and the session ID
   - Select "Attendance" role
   - Click "Join Session"

3. **Join as Observer**:

   - Enter your name and the session ID
   - Select "Guest" role
   - Click "Join Session"

4. **Voting Process**:
   - Participants select estimation points
   - Host reveals votes when all participants have voted
   - View results and statistics
   - Host can reset votes for next round

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure

```
estimation-tool/
├── app/                 # Next.js app directory
│   ├── actions.ts      # Server actions
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Main application page
├── components/         # React components
│   ├── ui/            # shadcn/ui components
│   └── ...            # Custom components
├── hooks/             # Custom React hooks
├── lib/               # Utility functions and configurations
└── public/            # Static assets
```

---

## Chinese

一个为敏捷团队设计的实时协作估点工具，支持基于角色的访问控制的规划扑克会话。

### 功能特性

- **实时协作**: 多个用户可以同时加入会话
- **基于角色的访问控制**: 三种不同权限的角色
  - **主持人**: 创建会话、管理模板、控制投票流程
  - **参与者**: 加入会话并参与投票
  - **旁观者**: 观察会话但不参与投票
- **多种估点模板**: 菲波那契数列、自然数、自定义值
- **双语支持**: 中文和英文界面
- **主题色自定义**: 四种精美主题色供选择
- **响应式设计**: 支持桌面和移动设备
- **实时更新**: 实时会话更新和用户状态

### 技术栈

- **前端**: Next.js 15, React, TypeScript
- **样式**: Tailwind CSS, shadcn/ui 组件
- **状态管理**: 服务端会话存储
- **实时性**: 基于轮询的更新

### 快速开始

#### 环境要求

- Node.js 18+
- npm 或 yarn

#### 安装步骤

1. 克隆仓库

```bash
git clone <repository-url>
cd estimation-tool
```

2. 安装依赖

```bash
npm install
```

3. 启动开发服务器

```bash
npm run dev
```

4. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)

#### 使用方法

1. **创建会话 (主持人)**:

   - 输入姓名和会话 ID
   - 选择"主持人"角色
   - 点击"创建会话"

2. **作为参与者加入**:

   - 输入姓名和会话 ID
   - 选择"参与者"角色
   - 点击"加入会话"

3. **作为旁观者加入**:

   - 输入姓名和会话 ID
   - 选择"旁观者"角色
   - 点击"加入会话"

4. **投票流程**:
   - 参与者选择估点值
   - 主持人显示所有参与者的投票
   - 查看结果和统计信息
   - 主持人可以重置投票进行下一轮

### 可用脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器
- `npm run lint` - 运行 ESLint

### 项目结构

```
estimation-tool/
├── app/                 # Next.js 应用目录
│   ├── actions.ts      # 服务端操作
│   ├── layout.tsx      # 根布局
│   └── page.tsx        # 主应用页面
├── components/         # React 组件
│   ├── ui/            # shadcn/ui 组件
│   └── ...            # 自定义组件
├── hooks/             # 自定义 React hooks
├── lib/               # 工具函数和配置
└── public/            # 静态资源
```

---

## License

MIT License
