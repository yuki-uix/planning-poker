import Redis from 'ioredis';

export type UserRole = "host" | "attendance" | "guest";

interface User {
  id: string;
  name: string;
  role: UserRole;
  vote: string | null;
  hasVoted: boolean;
  lastSeen: number;
}

interface SessionData {
  id: string;
  users: User[];
  revealed: boolean;
  votes: Record<string, string>;
  createdAt: number;
  hostId: string;
  template: {
    type: string;
    customCards?: string;
  };
}

export class RedisSessionStore {
  private redis: Redis;
  private readonly SESSION_PREFIX = 'session:';
  private readonly CONNECTION_PREFIX = 'connections:';
  private readonly USER_CONNECTION_KEY = 'user_connections';
  private readonly SESSION_LOCK_PREFIX = 'lock:';
  private readonly SESSION_TTL = 3600; // 1小时过期

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3, // 减少重试次数，避免堆积
      lazyConnect: true,
      enableOfflineQueue: true, // 启用离线队列
      enableReadyCheck: true,
      // 优化超时配置
      connectTimeout: 15000, // 增加连接超时
      commandTimeout: 10000, // 增加命令超时
      // 添加健康检查
      keepAlive: 30000,
      family: 4,
      // 添加TLS支持（Upstash Redis需要）
      tls: process.env.REDIS_HOST && process.env.REDIS_HOST.includes('upstash.io') ? {} : undefined,
      // 添加重连配置
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    // 增强错误处理
    this.redis.on('error', (error: Error) => {
      console.error('Redis connection error:', error);
      // 记录错误但不中断应用
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });

    this.redis.on('ready', () => {
      console.log('Redis is ready');
    });

    this.redis.on('close', () => {
      console.log('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });
  }

  // 获取会话 - 优化清理逻辑
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionData = await this.redis.get(`${this.SESSION_PREFIX}${sessionId}`);
      if (!sessionData) return null;

      const session = JSON.parse(sessionData) as SessionData;
      
      // 更宽松的活跃用户检测（从120秒改为180秒）
      const now = Date.now();
      const activeUsers = session.users.filter(
        (user) => now - user.lastSeen < 180000 // 3分钟
      );

      // 只有当用户数量显著减少时才清理（从80%改为90%）
      if (activeUsers.length < session.users.length * 0.9) {
        const updatedSession = { ...session, users: activeUsers };
        await this.redis.setex(
          `${this.SESSION_PREFIX}${sessionId}`, 
          this.SESSION_TTL, 
          JSON.stringify(updatedSession)
        );
        console.log(`Cleaned up ${session.users.length - activeUsers.length} inactive users from session ${sessionId}`);
        return updatedSession;
      }

      return session;
    } catch (error) {
      console.error('Failed to get session:', error);
      // 返回null而不是抛出错误，避免级联失败
      return null;
    }
  }

  // 创建会话
  async createSession(
    sessionId: string,
    userId: string,
    userName: string
  ): Promise<SessionData> {
    try {
      const now = Date.now();

      const hostUser: User = {
        id: userId,
        name: userName,
        role: "host",
        vote: null,
        hasVoted: false,
        lastSeen: now,
      };

      const newSession: SessionData = {
        id: sessionId,
        users: [hostUser],
        revealed: false,
        votes: {},
        createdAt: now,
        hostId: userId,
        template: {
          type: "fibonacci",
          customCards: "☕️,1,2,3,5,8,13",
        },
      };

      await this.redis.setex(
        `${this.SESSION_PREFIX}${sessionId}`, 
        this.SESSION_TTL, 
        JSON.stringify(newSession)
      );

      console.log(`Session created successfully: ${sessionId}`);
      return newSession;
    } catch (error) {
      console.error(`Failed to create session ${sessionId}:`, error);
      throw error;
    }
  }

  // 加入会话
  async joinSession(
    sessionId: string,
    userId: string,
    userName: string,
    role: UserRole
  ): Promise<SessionData> {
    const existingSession = await this.getSession(sessionId);
    if (!existingSession) {
      throw new Error("Session not found");
    }

    const now = Date.now();
    const newUser: User = {
      id: userId,
      name: userName,
      role,
      vote: null,
      hasVoted: false,
      lastSeen: now,
    };

    // 移除相同ID的现有用户并添加新用户
    const otherUsers = existingSession.users.filter((user) => user.id !== userId);
    const updatedSession = {
      ...existingSession,
      users: [...otherUsers, newUser],
    };

    await this.redis.setex(
      `${this.SESSION_PREFIX}${sessionId}`, 
      this.SESSION_TTL, 
      JSON.stringify(updatedSession)
    );

    return updatedSession;
  }

  // 原子操作更新会话
  async updateSession(
    sessionId: string, 
    updater: (session: SessionData) => SessionData
  ): Promise<SessionData> {
    const lockKey = `${this.SESSION_LOCK_PREFIX}${sessionId}`;
    
    // 尝试获取锁
    const lock = await this.redis.set(lockKey, '1', 'PX', 5000, 'NX');
    
    if (!lock) {
      throw new Error('Session is locked, please retry');
    }

    try {
      const session = await this.getSession(sessionId);
      if (!session) throw new Error('Session not found');
      
      const updatedSession = updater(session);
      await this.redis.setex(
        `${this.SESSION_PREFIX}${sessionId}`, 
        this.SESSION_TTL, 
        JSON.stringify(updatedSession)
      );
      
      return updatedSession;
    } finally {
      // 释放锁
      await this.redis.del(lockKey);
    }
  }

  // 更新用户投票
  async updateUserVote(sessionId: string, userId: string, vote: string): Promise<SessionData | null> {
    return this.updateSession(sessionId, (session) => {
      const user = session.users.find((u) => u.id === userId);
      if (!user || (user.role !== "attendance" && user.role !== "host")) {
        return session;
      }

      const updatedUsers = session.users.map((user) =>
        user.id === userId
          ? { ...user, vote, hasVoted: true, lastSeen: Date.now() }
          : user
      );

      const updatedVotes = { ...session.votes, [userId]: vote };

      return {
        ...session,
        users: updatedUsers,
        votes: updatedVotes,
      };
    });
  }

  // 显示投票
  async revealSessionVotes(sessionId: string, userId: string): Promise<SessionData | null> {
    return this.updateSession(sessionId, (session) => {
      if (session.hostId !== userId) {
        return session;
      }
      return { ...session, revealed: true };
    });
  }

  // 重置投票
  async resetSessionVotes(sessionId: string, userId: string): Promise<SessionData | null> {
    return this.updateSession(sessionId, (session) => {
      if (session.hostId !== userId) {
        return session;
      }

      const updatedUsers = session.users.map((user) => ({
        ...user,
        vote: null,
        hasVoted: false,
        lastSeen: Date.now(),
      }));

      return {
        ...session,
        users: updatedUsers,
        votes: {},
        revealed: false,
      };
    });
  }

  // 更新会话模板
  async updateSessionTemplate(
    sessionId: string,
    userId: string,
    templateType: string,
    customCards?: string
  ): Promise<SessionData | null> {
    return this.updateSession(sessionId, (session) => {
      if (session.hostId !== userId) {
        return session;
      }

      // 清除所有用户的投票记录
      const updatedUsers = session.users.map((user) => ({
        ...user,
        vote: null,
        hasVoted: false,
        lastSeen: Date.now(),
      }));

      return {
        ...session,
        users: updatedUsers,
        votes: {},
        revealed: false,
        template: {
          type: templateType,
          customCards,
        },
      };
    });
  }

  // 更新用户心跳
  async updateUserHeartbeat(sessionId: string, userId: string): Promise<SessionData | null> {
    return this.updateSession(sessionId, (session) => {
      const updatedUsers = session.users.map((user) =>
        user.id === userId ? { ...user, lastSeen: Date.now() } : user
      );

      return { ...session, users: updatedUsers };
    });
  }

  // 连接管理
  async addConnection(sessionId: string, userId: string, connectionId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.sadd(`${this.CONNECTION_PREFIX}${sessionId}`, connectionId);
    pipeline.hset(this.USER_CONNECTION_KEY, userId, connectionId);
    pipeline.expire(`${this.CONNECTION_PREFIX}${sessionId}`, this.SESSION_TTL);
    await pipeline.exec();
  }

  async removeConnection(sessionId: string, userId: string, connectionId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.srem(`${this.CONNECTION_PREFIX}${sessionId}`, connectionId);
    pipeline.hdel(this.USER_CONNECTION_KEY, userId);
    await pipeline.exec();
  }

  // 获取会话连接数
  async getSessionConnectionCount(sessionId: string): Promise<number> {
    return await this.redis.scard(`${this.CONNECTION_PREFIX}${sessionId}`);
  }

  // 获取会话所有连接ID
  async getSessionConnections(sessionId: string): Promise<string[]> {
    return await this.redis.smembers(`${this.CONNECTION_PREFIX}${sessionId}`);
  }

  // 检查用户是否为主持人
  async isHost(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session?.hostId === userId;
  }

  // 检查用户是否可以投票
  async canVote(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    const user = session.users.find((u) => u.id === userId);
    return user ? (user.role === "attendance" || user.role === "host") : false;
  }

  // 转移主持人权限
  async transferHostRole(sessionId: string, currentHostId: string): Promise<SessionData | null> {
    return this.updateSession(sessionId, (session) => {
      if (session.hostId !== currentHostId) {
        return session;
      }

      // 找到第一个attendance用户
      const firstAttendance = session.users.find(
        (user) => user.role === "attendance" && user.id !== currentHostId
      );

      if (!firstAttendance) {
        // 如果没有其他attendance用户，保持原会话不变
        return session;
      }

      // 更新hostId和用户角色
      const updatedUsers = session.users.map((user) => {
        if (user.id === firstAttendance.id) {
          return { ...user, role: "host" as UserRole };
        } else if (user.id === currentHostId) {
          return { ...user, role: "attendance" as UserRole };
        }
        return user;
      });

      return {
        ...session,
        users: updatedUsers,
        hostId: firstAttendance.id,
      };
    });
  }

  // 清理过期会话
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
      const now = Date.now();
      
      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData) as SessionData;
          // 增加活跃用户检测时间到10分钟
          const activeUsers = session.users.filter(
            (user) => now - user.lastSeen < 600000 // 10分钟
          );
          
          if (activeUsers.length === 0) {
            // 没有活跃用户，删除会话
            await this.redis.del(key);
            await this.redis.del(`${this.CONNECTION_PREFIX}${session.id}`);
            console.log(`Cleaned up expired session: ${session.id}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }

  // 获取存储统计信息
  async getStats(): Promise<{
    totalSessions: number;
    totalConnections: number;
    memoryUsage: string;
  }> {
    const sessionKeys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
    const connectionKeys = await this.redis.keys(`${this.CONNECTION_PREFIX}*`);
    
    let totalConnections = 0;
    for (const key of connectionKeys) {
      totalConnections += await this.redis.scard(key);
    }

    const info = await this.redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

    return {
      totalSessions: sessionKeys.length,
      totalConnections,
      memoryUsage,
    };
  }

  // 关闭连接
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// 导出单例实例
export const redisSessionStore = new RedisSessionStore();

// 定期清理过期会话
setInterval(() => {
  redisSessionStore.cleanupExpiredSessions();
}, 300000); // 每5分钟清理一次 