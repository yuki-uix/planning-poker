# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start Next.js development server and run WebSocket server separately with `npm run websocket`
- `npm run build` - Build the Next.js application for production
- `npm run start` - Start the production Next.js server
- `npm run lint` - Run ESLint for code quality checks
- `npm run websocket` - Start the WebSocket server (uses tsx to run websocket-server.ts)

## Architecture Overview

This is a real-time collaborative planning poker application with a hybrid architecture:

### Frontend Architecture
- **Next.js 15** with React Server Components and client components
- **Dual-server architecture**: Next.js app server (port 3000) + separate WebSocket server (port 3001)
- **Component Structure**: Follows strict separation pattern defined in `.cursor/rules/`:
  - `components/[component-name]/index.tsx` - Pure UI rendering
  - `components/[component-name]/use[ComponentName].ts` - Business logic hooks
  - `components/[component-name]/types.ts` - Type definitions
- **State Management**: Server actions + WebSocket real-time updates
- **UI Framework**: shadcn/ui components with Tailwind CSS

### Backend Architecture
- **Session Management**: Redis-based distributed session storage (`lib/redis-session-store.ts`)
- **Real-time Communication**: WebSocket server with connection pooling (`lib/connection-pool.ts`)
- **Performance Optimizations**:
  - Connection pool management with health checks
  - Message optimization and compression
  - Heartbeat management for connection stability
  - Support for 12+ concurrent users per session

### Key Libraries and Patterns
- **Styling**: Tailwind CSS + shadcn/ui component library
- **Forms**: React Hook Form with Zod validation
- **Real-time**: WebSocket client (`lib/websocket-client.ts`) with automatic reconnection
- **Internationalization**: Custom i18n implementation (`lib/i18n.ts`) supporting Chinese/English
- **TypeScript**: Strict typing with custom types in `types/estimation.ts`

## Component Architecture Rules

The codebase follows strict architectural patterns defined in `.cursor/rules/`:

1. **Component Structure**: Each component should have maximum 3 files:
   - `index.tsx` - Pure rendering, no business logic
   - `use[ComponentName].ts` - All business logic, state management, and event handlers
   - `types.ts` - Type definitions

2. **Function Parameters**: Maximum 4 parameters for any function/method/hook

3. **Single Responsibility**: Each file should focus on a single function

4. **Avoid Circular Dependencies**: Maintain clean dependency graph

## Session and Role Management

The application supports three user roles with different permissions:
- **Host**: Create sessions, manage templates, control voting flow, transfer host role
- **Attendance**: Join sessions and participate in voting
- **Guest**: Observe sessions without voting privileges

Sessions are managed through server actions in `app/actions.ts` and persisted using Redis for distributed deployment.

## Real-time Features

- WebSocket connection management with automatic reconnection
- Connection pooling for performance optimization
- Heartbeat system for connection health monitoring
- Message batching and optimization for improved performance
- Support for multiple estimation templates (Fibonacci, Natural Numbers, Custom)

## Deployment

The application supports both development and production deployment:
- **Development**: Dual server setup (Next.js + WebSocket)
- **Production**: Docker-based deployment with Nginx load balancing
- **Scaling**: Redis-based session storage allows horizontal scaling