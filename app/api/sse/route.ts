import { NextRequest } from 'next/server';
import { redisSessionStore } from '@/lib/redis-session-store';

// SSE连接存储
const sseConnections = new Map<string, {
  sessionId: string;
  userId: string;
  controller: ReadableStreamDefaultController;
  lastHeartbeat: number;
}>();

// 生成连接ID
function generateSSEConnectionId(): string {
  return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 发送SSE消息
function sendSSEMessage(controller: ReadableStreamDefaultController, data: Record<string, unknown>): void {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

// 广播消息到会话的所有SSE连接
async function broadcastToSessionSSE(sessionId: string, message: Record<string, unknown>): Promise<void> {
  const connections = Array.from(sseConnections.values()).filter(
    conn => conn.sessionId === sessionId
  );

  connections.forEach(conn => {
    try {
      sendSSEMessage(conn.controller, message);
    } catch (error) {
      console.error('Failed to send SSE message:', error);
      // 移除失效的连接
      sseConnections.delete(conn.userId);
    }
  });
}

// 处理SSE消息
async function handleSSEMessage(sessionId: string, userId: string, message: Record<string, unknown>): Promise<void> {
  const messageType = message.type as string;
  
  switch (messageType) {
    case 'heartbeat':
      // 更新心跳时间
      const connection = sseConnections.get(userId);
      if (connection) {
        connection.lastHeartbeat = Date.now();
      }
      
      // 发送心跳确认
      await broadcastToSessionSSE(sessionId, {
        type: 'heartbeat_ack',
        sessionId,
        userId,
        timestamp: Date.now()
      });
      break;

    case 'vote':
      // 处理投票
      const voteData = message.data as Record<string, unknown>;
      if (voteData?.vote) {
        const session = await redisSessionStore.updateUserVote(sessionId, userId, voteData.vote as string);
        if (session) {
          await broadcastToSessionSSE(sessionId, {
            type: 'session_update',
            sessionId,
            data: session,
            timestamp: Date.now()
          });
        }
      }
      break;

    case 'reveal':
      // 处理显示投票
      const session = await redisSessionStore.revealSessionVotes(sessionId, userId);
      if (session) {
        await broadcastToSessionSSE(sessionId, {
          type: 'session_update',
          sessionId,
          data: session,
          timestamp: Date.now()
        });
      }
      break;

    case 'reset':
      // 处理重置投票
      const resetSession = await redisSessionStore.resetSessionVotes(sessionId, userId);
      if (resetSession) {
        await broadcastToSessionSSE(sessionId, {
          type: 'session_update',
          sessionId,
          data: resetSession,
          timestamp: Date.now()
        });
      }
      break;

    case 'template_update':
      // 处理模板更新
      const templateData = message.data as Record<string, unknown>;
      if (templateData?.type) {
        const templateSession = await redisSessionStore.updateSessionTemplate(
          sessionId,
          userId,
          templateData.type as string,
          templateData.customCards as string
        );
        if (templateSession) {
          await broadcastToSessionSSE(sessionId, {
            type: 'session_update',
            sessionId,
            data: templateSession,
            timestamp: Date.now()
          });
        }
      }
      break;

    default:
      console.warn('Unknown SSE message type:', message.type);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const userId = searchParams.get('userId');

  if (!sessionId || !userId) {
    return new Response('Missing sessionId or userId', { status: 400 });
  }

  // 检查会话是否存在
  try {
    const session = await redisSessionStore.getSession(sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }
  } catch (error) {
    console.error('Failed to get session:', error);
    return new Response('Internal server error', { status: 500 });
  }

  // 注册到Redis
  const connectionId = generateSSEConnectionId();
  try {
    await redisSessionStore.addConnection(sessionId, userId, connectionId);
  } catch (error) {
    console.error('Failed to register SSE connection in Redis:', error);
  }

  // 创建SSE流
  const stream = new ReadableStream({
    start(controller) {
      // 注册SSE连接
      sseConnections.set(userId, {
        sessionId,
        userId,
        controller,
        lastHeartbeat: Date.now()
      });

      console.log(`SSE client connected: ${userId} to session ${sessionId}`);

      // 发送连接确认
      sendSSEMessage(controller, {
        type: 'session_update',
        sessionId,
        data: { id: sessionId, connected: true },
        timestamp: Date.now()
      });

      // 设置心跳检查
      const heartbeatInterval = setInterval(() => {
        const connection = sseConnections.get(userId);
        if (connection) {
          const now = Date.now();
          if (now - connection.lastHeartbeat > 90000) { // 90秒超时（更宽松）
            console.log(`SSE connection timeout for user ${userId}`);
            sseConnections.delete(userId);
            clearInterval(heartbeatInterval);
            controller.close();
          }
        }
      }, 30000); // 每30秒检查一次

      // 处理客户端断开
      request.signal.addEventListener('abort', () => {
        console.log(`SSE client disconnected: ${userId}`);
        sseConnections.delete(userId);
        clearInterval(heartbeatInterval);
        
        // 从Redis移除连接
        redisSessionStore.removeConnection(sessionId, userId, connectionId).catch(error => {
          console.error('Failed to remove SSE connection from Redis:', error);
        });
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

// 处理POST请求（用于接收客户端消息）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId, ...message } = body;

    if (!sessionId || !userId) {
      return new Response('Missing sessionId or userId', { status: 400 });
    }

    await handleSSEMessage(sessionId, userId, message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to handle SSE POST request:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 