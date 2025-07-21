import { NextRequest, NextResponse } from 'next/server';
import { redisSessionStore } from '@/lib/redis-session-store';

interface SSEMessage {
  type: string;
  sessionId?: string;
  userId?: string;
  session?: {
    id: string;
    users: {
      id: string;
      name: string;
      role: string;
      vote: string | null;
      hasVoted: boolean;
      lastSeen: number;
    }[];
    revealed: boolean;
    votes: Record<string, string>;
    hostId: string;
    template: {
      type: string;
      customCards?: string;
    };
  };
  timestamp?: number;
  message?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const userId = searchParams.get('userId');

  if (!sessionId || !userId) {
    return NextResponse.json(
      { error: 'Missing sessionId or userId' },
      { status: 400 }
    );
  }

  // Render支持更长的连接时间，可以延长到5分钟
  const SSE_TIMEOUT = 300000; // 5分钟
  const HEARTBEAT_INTERVAL = 30000; // 30秒
  const SESSION_CHECK_INTERVAL = 15000; // 15秒

  // 设置 SSE 响应头
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isConnected = true;
      let heartbeatInterval: NodeJS.Timeout;
      let sessionCheckInterval: NodeJS.Timeout;

      // 发送连接确认
      const sendMessage = (data: SSEMessage) => {
        if (!isConnected) return;
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // 发送心跳
      const sendHeartbeat = () => {
        if (!isConnected) return;
        sendMessage({ type: 'heartbeat', timestamp: Date.now() });
      };

      // 检查会话状态
      const checkSession = async () => {
        if (!isConnected) return;
        try {
          const session = await redisSessionStore.getSession(sessionId);
          if (!session) {
            sendMessage({ type: 'session_expired' });
            isConnected = false;
            controller.close();
            return;
          }
          
          // 发送会话更新
          sendMessage({
            type: 'session_update',
            session: {
              id: session.id,
              users: session.users,
              revealed: session.revealed,
              votes: session.votes,
              hostId: session.hostId,
              template: session.template
            }
          });
        } catch (error) {
          console.error('Session check failed:', error);
          // 不立即断开连接，继续尝试
        }
      };

      try {
        // 验证会话存在
        const session = await redisSessionStore.getSession(sessionId);
        if (!session) {
          sendMessage({ type: 'session_not_found' });
          controller.close();
          return;
        }

        // 发送连接成功消息
        sendMessage({ 
          type: 'connected',
          sessionId,
          userId,
          timestamp: Date.now()
        });

        // 设置心跳（每 30 秒）
        heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

        // 设置会话检查（每 15 秒）
        sessionCheckInterval = setInterval(checkSession, SESSION_CHECK_INTERVAL);

        // 立即检查一次会话状态
        await checkSession();

      } catch (error) {
        console.error('SSE connection setup failed:', error);
        sendMessage({ 
          type: 'error',
          message: 'Connection setup failed'
        });
        controller.close();
      }

      // 清理函数
      const cleanup = () => {
        isConnected = false;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (sessionCheckInterval) clearInterval(sessionCheckInterval);
      };

      // 监听客户端断开
      request.signal.addEventListener('abort', () => {
        console.log('SSE client disconnected');
        cleanup();
        controller.close();
      });

      // Render支持更长的超时时间
      setTimeout(() => {
        if (isConnected) {
          console.log('SSE connection timeout');
          cleanup();
          controller.close();
        }
      }, SSE_TIMEOUT);

    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
} 