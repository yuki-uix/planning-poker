import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { redisSessionStore } from './redis-session-store';
import { UserRole } from './session-store';

interface AuthSession {
  userId: string;
  userName: string;
  sessionId: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

interface UserIdentity {
  id: string;
  name: string;
  authenticatedSessions: string[]; // sessionIds where user is authenticated
  lastActivity: number;
}

export class AuthStore {
  private readonly COOKIE_NAME = 'planning_poker_auth';
  private readonly USER_PREFIX = 'user:';
  private readonly AUTH_PREFIX = 'auth:';
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private redis = redisSessionStore;

  // Generate secure authentication token
  private generateAuthToken(): string {
    return uuidv4();
  }

  // Create authentication session
  async createAuthSession(
    userId: string,
    userName: string,
    sessionId: string,
    role: UserRole
  ): Promise<string> {
    const authToken = this.generateAuthToken();
    const now = Date.now();
    
    const authSession: AuthSession = {
      userId,
      userName,
      sessionId,
      role,
      createdAt: now,
      expiresAt: now + this.SESSION_DURATION,
    };

    // Store auth session in Redis
    await redisSessionStore.redis.setex(
      `${this.AUTH_PREFIX}${authToken}`,
      this.SESSION_DURATION / 1000, // Redis TTL in seconds
      JSON.stringify(authSession)
    );

    // Update or create user identity
    await this.updateUserIdentity(userId, userName, sessionId);

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(this.COOKIE_NAME, authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.SESSION_DURATION / 1000,
      path: '/',
    });

    return authToken;
  }

  // Get authentication session
  async getAuthSession(authToken?: string): Promise<AuthSession | null> {
    if (!authToken) {
      const cookieStore = await cookies();
      const tokenCookie = cookieStore.get(this.COOKIE_NAME);
      authToken = tokenCookie?.value;
    }

    if (!authToken) return null;

    try {
      const authData = await redisSessionStore.redis.get(`${this.AUTH_PREFIX}${authToken}`);
      if (!authData) return null;

      const session = JSON.parse(authData) as AuthSession;
      
      // Check if session expired
      if (Date.now() > session.expiresAt) {
        await this.clearAuthSession(authToken);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to get auth session:', error);
      return null;
    }
  }

  // Update user identity tracking
  private async updateUserIdentity(
    userId: string,
    userName: string,
    sessionId: string
  ): Promise<void> {
    try {
      const userKey = `${this.USER_PREFIX}${userId}`;
      const existingData = await redisSessionStore.redis.get(userKey);
      
      let userIdentity: UserIdentity;
      if (existingData) {
        userIdentity = JSON.parse(existingData);
        userIdentity.name = userName; // Update name in case it changed
        userIdentity.lastActivity = Date.now();
        
        // Add sessionId if not already present
        if (!userIdentity.authenticatedSessions.includes(sessionId)) {
          userIdentity.authenticatedSessions.push(sessionId);
        }
      } else {
        userIdentity = {
          id: userId,
          name: userName,
          authenticatedSessions: [sessionId],
          lastActivity: Date.now(),
        };
      }

      await redisSessionStore.redis.setex(
        userKey,
        this.SESSION_DURATION / 1000,
        JSON.stringify(userIdentity)
      );
    } catch (error) {
      console.error('Failed to update user identity:', error);
    }
  }

  // Verify user has permission for session role
  async verifyUserPermission(
    userId: string,
    sessionId: string,
    requiredRole?: UserRole
  ): Promise<{ valid: boolean; role?: UserRole; isHost?: boolean }> {
    try {
      // Check if user exists in session
      const session = await redisSessionStore.getSession(sessionId);
      if (!session) return { valid: false };

      const user = session.users.find(u => u.id === userId);
      if (!user) return { valid: false };

      // Check role requirements
      if (requiredRole && user.role !== requiredRole && user.role !== 'host') {
        return { valid: false };
      }

      return {
        valid: true,
        role: user.role,
        isHost: session.hostId === userId,
      };
    } catch (error) {
      console.error('Failed to verify user permission:', error);
      return { valid: false };
    }
  }

  // Get user identity
  async getUserIdentity(userId: string): Promise<UserIdentity | null> {
    try {
      const userKey = `${this.USER_PREFIX}${userId}`;
      const userData = await redisSessionStore.redis.get(userKey);
      
      if (!userData) return null;
      
      const identity = JSON.parse(userData) as UserIdentity;
      
      // Check if identity is still valid (not expired)
      if (Date.now() - identity.lastActivity > this.SESSION_DURATION) {
        await redisSessionStore.redis.del(userKey);
        return null;
      }
      
      return identity;
    } catch (error) {
      console.error('Failed to get user identity:', error);
      return null;
    }
  }

  // Clear authentication session
  async clearAuthSession(authToken?: string): Promise<void> {
    if (!authToken) {
      const cookieStore = await cookies();
      const tokenCookie = cookieStore.get(this.COOKIE_NAME);
      authToken = tokenCookie?.value;
    }

    if (authToken) {
      await redisSessionStore.redis.del(`${this.AUTH_PREFIX}${authToken}`);
    }

    // Clear cookie
    const cookieStore = await cookies();
    cookieStore.delete(this.COOKIE_NAME);
  }

  // Restore user session with authentication
  async restoreUserSession(): Promise<{
    success: boolean;
    userId?: string;
    userName?: string;
    sessionId?: string;
    role?: UserRole;
    isHost?: boolean;
  }> {
    try {
      const authSession = await this.getAuthSession();
      if (!authSession) {
        return { success: false };
      }

      // Verify the session still exists and user is still in it
      const verification = await this.verifyUserPermission(
        authSession.userId,
        authSession.sessionId
      );

      if (!verification.valid) {
        await this.clearAuthSession();
        return { success: false };
      }

      return {
        success: true,
        userId: authSession.userId,
        userName: authSession.userName,
        sessionId: authSession.sessionId,
        role: verification.role,
        isHost: verification.isHost,
      };
    } catch (error) {
      console.error('Failed to restore user session:', error);
      return { success: false };
    }
  }

  // Clean up expired authentication data
  async cleanupExpiredAuth(): Promise<void> {
    try {
      // Clean up expired auth tokens
      const authKeys = await redisSessionStore.redis.keys(`${this.AUTH_PREFIX}*`);
      const now = Date.now();
      
      for (const key of authKeys) {
        const authData = await redisSessionStore.redis.get(key);
        if (authData) {
          try {
            const session = JSON.parse(authData) as AuthSession;
            if (now > session.expiresAt) {
              await redisSessionStore.redis.del(key);
            }
          } catch {
            // If parsing fails, delete corrupted data
            await redisSessionStore.redis.del(key);
          }
        }
      }

      // Clean up expired user identities
      const userKeys = await redisSessionStore.redis.keys(`${this.USER_PREFIX}*`);
      
      for (const key of userKeys) {
        const userData = await redisSessionStore.redis.get(key);
        if (userData) {
          try {
            const identity = JSON.parse(userData) as UserIdentity;
            if (now - identity.lastActivity > this.SESSION_DURATION) {
              await redisSessionStore.redis.del(key);
            }
          } catch {
            await redisSessionStore.redis.del(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired auth data:', error);
    }
  }
}

// Export singleton instance
export const authStore = new AuthStore();

// Initialize periodic cleanup after a delay to avoid startup issues
if (typeof window === 'undefined') {
  setTimeout(() => {
    try {
      setInterval(() => {
        authStore.cleanupExpiredAuth().catch(error => {
          console.error('Auth cleanup failed:', error);
        });
      }, 5 * 60 * 1000); // Every 5 minutes
    } catch (error) {
      console.error('Failed to initialize auth cleanup:', error);
    }
  }, 30000); // Wait 30 seconds before starting cleanup
}