// 统一的连接管理器
// 简化版本，专注于稳定性

import { redisSessionStore } from './redis-session-store';

// 客户端检查
const isClient = typeof window !== 'undefined';

export interface ConnectionConfig {
  sessionId: string;
  userId: string;
  pollingInterval?: number;
  heartbeatInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ConnectionState {
  isConnected: boolean;
  lastHeartbeat: number;
  retryCount: number;
  lastError: string | null;
  connectionType: 'polling' | 'sse';
}

export interface ConnectionMessage {
  type: 'vote' | 'reveal' | 'reset' | 'template_update';
  vote?: string;
  templateType?: string;
  customCards?: string;
}

export class ConnectionManager {
  private config: ConnectionConfig;
  private state: ConnectionState;
  private pollingInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isShutdown = false;

  // Vercel 环境检测
  private isVercel = process.env.VERCEL === '1';
  private isDevelopment = process.env.NODE_ENV === 'development';

  constructor(config: ConnectionConfig) {
    this.config = {
      pollingInterval: 3000, // 默认3秒
      heartbeatInterval: 25000, // 默认25秒
      maxRetries: 5,
      retryDelay: 1000,
      ...config
    };

    // Vercel 环境优化
    if (this.isVercel) {
      this.config.pollingInterval = 5000; // Vercel 环境下增加轮询间隔
      this.config.heartbeatInterval = 20000; // 减少心跳间隔
      this.config.maxRetries = 3; // 减少重试次数
    }

    this.state = {
      isConnected: false,
      lastHeartbeat: 0,
      retryCount: 0,
      lastError: null,
      connectionType: 'polling'
    };
  }

  async connect(): Promise<void> {
    if (this.isShutdown || isClient) return;

    try {
      // 验证会话存在
      const session = await redisSessionStore.getSession(this.config.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // 更新用户心跳
      await redisSessionStore.updateUserHeartbeat(this.config.sessionId, this.config.userId);
      
      this.state.isConnected = true;
      this.state.retryCount = 0;
      this.state.lastError = null;
      this.state.lastHeartbeat = Date.now();

      console.log(`Connected to session ${this.config.sessionId} as user ${this.config.userId}`);

      // 启动轮询
      this.startPolling();
      
      // 启动心跳
      this.startHeartbeat();

    } catch (error) {
      console.error('Connection failed:', error);
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.handleConnectionError();
    }
  }

  private startPolling(): void {
    if (this.pollingInterval || isClient) {
      if (this.pollingInterval) clearInterval(this.pollingInterval);
      return;
    }

    this.pollingInterval = setInterval(async () => {
      if (this.isShutdown || isClient) return;

      try {
        const session = await redisSessionStore.getSession(this.config.sessionId);
        if (!session) {
          throw new Error('Session expired');
        }

        // 更新用户心跳
        await redisSessionStore.updateUserHeartbeat(this.config.sessionId, this.config.userId);
        
        this.state.lastHeartbeat = Date.now();
        this.state.retryCount = 0;
        this.state.lastError = null;

      } catch (error) {
        console.error('Polling failed:', error);
        this.state.lastError = error instanceof Error ? error.message : 'Polling error';
        this.handleConnectionError();
      }
    }, this.config.pollingInterval);
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval || isClient) {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      return;
    }

    this.heartbeatInterval = setInterval(async () => {
      if (this.isShutdown || isClient) return;

      try {
        // 检查连接健康状态
        const session = await redisSessionStore.getSession(this.config.sessionId);
        if (!session) {
          throw new Error('Session not found during heartbeat');
        }

        // 更新用户心跳
        await redisSessionStore.updateUserHeartbeat(this.config.sessionId, this.config.userId);
        
        this.state.lastHeartbeat = Date.now();

        // Vercel 环境下的额外检查
        if (this.isVercel) {
          const now = Date.now();
          const timeSinceLastHeartbeat = now - this.state.lastHeartbeat;
          
          // 如果超过30秒没有心跳，尝试重新连接
          if (timeSinceLastHeartbeat > 30000) {
            console.log('Heartbeat timeout detected, attempting reconnection...');
            this.reconnect();
          }
        }

      } catch (error) {
        console.error('Heartbeat failed:', error);
        this.state.lastError = error instanceof Error ? error.message : 'Heartbeat error';
        this.handleConnectionError();
      }
    }, this.config.heartbeatInterval);
  }

  private handleConnectionError(): void {
    if (isClient) return;
    
    this.state.isConnected = false;
    this.state.retryCount++;

    if (this.state.retryCount <= (this.config.maxRetries || 5)) {
      console.log(`Connection error, retrying ${this.state.retryCount}/${this.config.maxRetries || 5}...`);
      
      // 指数退避重试
      const delay = (this.config.retryDelay || 1000) * Math.pow(2, this.state.retryCount - 1);
      setTimeout(() => {
        if (!this.isShutdown && !isClient) {
          this.connect();
        }
      }, delay);
    } else {
      console.error('Max retries reached, connection failed');
      this.state.lastError = 'Max retries reached';
    }
  }

  async reconnect(): Promise<void> {
    if (isClient) return;
    
    console.log('Attempting to reconnect...');
    this.state.retryCount = 0;
    await this.connect();
  }

  async sendMessage(message: ConnectionMessage): Promise<void> {
    if (!this.state.isConnected || isClient) {
      throw new Error('Not connected');
    }

    try {
      // 根据消息类型处理
      const messageType = message.type;
      
      switch (messageType) {
        case 'vote':
          if (!message.vote) {
            throw new Error('Vote value is required');
          }
          await redisSessionStore.updateUserVote(
            this.config.sessionId, 
            this.config.userId, 
            message.vote
          );
          break;
          
        case 'reveal':
          await redisSessionStore.revealSessionVotes(
            this.config.sessionId, 
            this.config.userId
          );
          break;
          
        case 'reset':
          await redisSessionStore.resetSessionVotes(
            this.config.sessionId, 
            this.config.userId
          );
          break;
          
        case 'template_update':
          if (!message.templateType) {
            throw new Error('Template type is required');
          }
          await redisSessionStore.updateSessionTemplate(
            this.config.sessionId,
            this.config.userId,
            message.templateType,
            message.customCards
          );
          break;
          
        default:
          throw new Error(`Unknown message type: ${messageType}`);
      }

      // 更新心跳
      this.state.lastHeartbeat = Date.now();
      
    } catch (error) {
      console.error('Failed to send message:', error);
      this.state.lastError = error instanceof Error ? error.message : 'Message send error';
      throw error;
    }
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  disconnect(): void {
    this.isShutdown = true;
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.state.isConnected = false;
    console.log('Connection manager disconnected');
  }
} 