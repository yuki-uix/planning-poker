import { NextRequest, NextResponse } from 'next/server';
import { redisSessionStore } from '@/lib/redis-session-store';
import { Session } from '@/types/estimation';

// 获取会话信息（用于HTTP轮询）
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // 从Redis获取会话信息，优化重试机制
    let session: Session | null = null;
    let retries = 0;
    const maxRetries = 2; // 减少重试次数

    while (retries < maxRetries) {
      try {
        session = await redisSessionStore.getSession(sessionId);
        break;
      } catch (error) {
        retries++;
        console.error(`Failed to get session (attempt ${retries}/${maxRetries}):`, error);
        
        if (retries < maxRetries) {
          // 指数退避 + 随机化重试
          const baseDelay = Math.pow(2, retries) * 1000;
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!session) {
      // 记录会话未找到的情况
      console.warn(`Session not found: ${sessionId} after ${retries} attempts`);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Failed to get session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// 处理会话操作（用于HTTP POST消息）
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const { type, userId, data } = body;

    if (!sessionId || !type || !userId) {
      return NextResponse.json(
        { error: 'Session ID, type, and user ID are required' },
        { status: 400 }
      );
    }

    // 获取会话，优化重试机制
    let session: Session | null = null;
    let retries = 0;
    const maxRetries = 2; // 减少重试次数

    while (retries < maxRetries) {
      try {
        session = await redisSessionStore.getSession(sessionId);
        break;
      } catch (error) {
        retries++;
        console.error(`Failed to get session for POST (attempt ${retries}/${maxRetries}):`, error);
        
        if (retries < maxRetries) {
          // 指数退避 + 随机化重试
          const baseDelay = Math.pow(2, retries) * 1000;
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // 处理不同类型的消息
    switch (type) {
      case 'vote':
        if (data?.vote) {
          await handleVote(session, userId, data.vote);
        }
        break;

      case 'reveal':
        await handleReveal(session, userId);
        break;

      case 'reset':
        await handleReset(session, userId);
        break;

      case 'template_update':
        if (data?.type) {
          await handleTemplateUpdate(session, userId, {
            type: data.type,
            customCards: data.customCards
          });
        }
        break;

      case 'heartbeat':
        // 处理心跳，更新用户最后活跃时间
        await handleHeartbeat(session, userId);
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown message type' },
          { status: 400 }
        );
    }

    // 更新会话，优化重试机制
    let updateRetries = 0;
    const maxUpdateRetries = 2; // 减少重试次数

    while (updateRetries < maxUpdateRetries) {
      try {
        await redisSessionStore.updateSession(sessionId, (currentSession) => {
          return {
            ...currentSession,
            ...session
          };
        });
        break;
      } catch (error) {
        updateRetries++;
        console.error(`Failed to update session (attempt ${updateRetries}/${maxUpdateRetries}):`, error);
        
        if (updateRetries < maxUpdateRetries) {
          // 指数退避 + 随机化重试
          const baseDelay = Math.pow(2, updateRetries) * 1000;
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process session action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}

// 处理投票
async function handleVote(session: Session, userId: string, vote: string) {
  // 检查用户是否有投票权限
  const user = session.users.find(u => u.id === userId);
  if (!user || user.role === 'guest') {
    throw new Error('User does not have permission to vote');
  }

  // 检查投票是否已显示
  if (session.revealed) {
    throw new Error('Cannot vote after results are revealed');
  }

  // 更新用户投票状态
  const updatedUsers = session.users.map(u => 
    u.id === userId 
      ? { ...u, vote, hasVoted: true, lastSeen: Date.now() }
      : u
  );

  // 更新投票
  session.users = updatedUsers;
  session.votes[userId] = vote;
  session.lastUpdated = Date.now();
}

// 处理显示投票
async function handleReveal(session: Session, userId: string) {
  // 检查用户是否是主持人
  if (session.hostId !== userId) {
    throw new Error('Only the host can reveal votes');
  }

  session.revealed = true;
  session.lastUpdated = Date.now();
}

// 处理重置投票
async function handleReset(session: Session, userId: string) {
  // 检查用户是否是主持人
  if (session.hostId !== userId) {
    throw new Error('Only the host can reset votes');
  }

  // 重置所有用户的投票状态
  const updatedUsers = session.users.map(user => ({
    ...user,
    vote: null,
    hasVoted: false,
    lastSeen: Date.now(),
  }));

  session.users = updatedUsers;
  session.votes = {};
  session.revealed = false;
  session.lastUpdated = Date.now();
}

// 处理模板更新
async function handleTemplateUpdate(
  session: Session, 
  userId: string, 
  templateData: { type: string; customCards?: string }
) {
  // 检查用户是否是主持人
  if (session.hostId !== userId) {
    throw new Error('Only the host can update template');
  }

  // 清除所有用户的投票记录
  const updatedUsers = session.users.map((user) => ({
    ...user,
    vote: null,
    hasVoted: false,
    lastSeen: Date.now(),
  }));

  session.users = updatedUsers;
  session.votes = {};
  session.revealed = false;
  session.template = {
    type: templateData.type,
    customCards: templateData.customCards
  };
  session.lastUpdated = Date.now();
}

// 处理心跳
async function handleHeartbeat(session: Session, userId: string) {
  // 更新用户最后活跃时间
  const updatedUsers = session.users.map(u => 
    u.id === userId 
      ? { ...u, lastSeen: Date.now() }
      : u
  );
  
  session.users = updatedUsers;
  session.lastUpdated = Date.now();
} 