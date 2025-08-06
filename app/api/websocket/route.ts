import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { redisSessionStore } from '@/lib/redis-session-store';
import { connectionPool } from '@/lib/connection-pool';
import { heartbeatManager } from '@/lib/heartbeat-manager';

// WebSocket服务器实例
let wss: WebSocketServer | null = null;

// 最大连接数限制
const MAX_CONNECTIONS_PER_SESSION = parseInt(process.env.MAX_CONNECTIONS_PER_SESSION || '20');

// 初始化WebSocket服务器
function initWebSocketServer() {
  if (wss) return wss;

  // 在开发环境中，我们需要手动创建WebSocket服务器
  // 在生产环境中，建议使用专门的WebSocket服务
  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
    console.log('WebSocket client connected');

    // 解析连接参数
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');

    if (!sessionId || !userId) {
      ws.close(1008, 'Missing sessionId or userId');
      return;
    }

    // 检查连接数量限制
    const currentConnections = connectionPool.getSessionConnectionCount(sessionId);
    if (currentConnections >= MAX_CONNECTIONS_PER_SESSION) {
      console.warn(`Session ${sessionId} connection limit reached (${currentConnections}/${MAX_CONNECTIONS_PER_SESSION})`);
      ws.close(1013, 'Session connection limit reached');
      return;
    }

    // 生成连接ID
    const connectionId = generateConnectionId();

    // 注册连接到池
    const added = connectionPool.addConnection(sessionId, ws, {
      sessionId,
      userId,
      connectionId
    });

    if (!added) {
      ws.close(1013, 'Connection pool is full');
      return;
    }

    // 设置连接元数据
    (ws as WebSocket & { sessionId: string; userId: string; connectionId: string }).sessionId = sessionId;
    (ws as WebSocket & { sessionId: string; userId: string; connectionId: string }).userId = userId;
    (ws as WebSocket & { sessionId: string; userId: string; connectionId: string }).connectionId = connectionId;

    // 注册到Redis
    try {
      await redisSessionStore.addConnection(sessionId, userId, connectionId);
    } catch (error) {
      console.error('Failed to register connection in Redis:', error);
    }

    // 开始心跳
    heartbeatManager.startHeartbeat(userId, ws);

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', async () => {
      console.log('WebSocket client disconnected');
      const sessionId = (ws as WebSocket & { sessionId: string; userId: string; connectionId: string }).sessionId;
      const userId = (ws as WebSocket & { sessionId: string; userId: string; connectionId: string }).userId;
      const connectionId = (ws as WebSocket & { sessionId: string; userId: string; connectionId: string }).connectionId;

      // 停止心跳
      heartbeatManager.stopHeartbeat(userId);

      // 从连接池移除
      if (sessionId) {
        connectionPool.removeConnection(sessionId, ws);
      }

      // 从Redis移除
      if (sessionId && userId && connectionId) {
        try {
          await redisSessionStore.removeConnection(sessionId, userId, connectionId);
        } catch (error) {
          console.error('Failed to remove connection from Redis:', error);
        }
      }
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
}

// 生成连接ID
function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// WebSocket消息类型定义
interface WebSocketMessage {
  type: 'heartbeat' | 'vote' | 'reveal' | 'reset' | 'template_update';
  sessionId: string;
  userId: string;
  data?: {
    vote?: string;
    type?: string;
    customCards?: string;
  };
  timestamp?: number;
}

// 处理WebSocket消息
async function handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage) {
  const sessionId = (ws as WebSocket & { sessionId: string; userId: string; connectionId: string }).sessionId;
  const userId = (ws as WebSocket & { sessionId: string; userId: string; connectionId: string }).userId;

  switch (message.type) {
    case 'heartbeat':
      // 处理心跳
      heartbeatManager.handleHeartbeatResponse(userId);
      await broadcastToSession(sessionId, {
        type: 'heartbeat_ack',
        sessionId,
        userId,
        timestamp: Date.now()
      });
      break;

    case 'vote':
      // 处理投票
      if (message.data?.vote) {
        await handleVote(sessionId, userId, message.data.vote);
      }
      break;

    case 'reveal':
      // 处理显示投票
      await handleReveal(sessionId, userId);
      break;

    case 'reset':
      // 处理重置投票
      await handleReset(sessionId, userId);
      break;

    case 'template_update':
      // 处理模板更新
      if (message.data?.type) {
        await handleTemplateUpdate(sessionId, userId, {
          type: message.data.type,
          customCards: message.data.customCards
        });
      }
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
}

// 处理投票
async function handleVote(sessionId: string, userId: string, vote: string) {
  try {
    const session = await redisSessionStore.updateUserVote(sessionId, userId, vote);
    
    if (session) {
      await broadcastToSession(sessionId, {
        type: 'session_update',
        sessionId,
        data: session,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Failed to handle vote:', error);
  }
}

// 处理显示投票
async function handleReveal(sessionId: string, userId: string) {
  try {
    const session = await redisSessionStore.revealSessionVotes(sessionId, userId);
    
    if (session) {
      await broadcastToSession(sessionId, {
        type: 'session_update',
        sessionId,
        data: session,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Failed to handle reveal:', error);
  }
}

// 处理重置投票
async function handleReset(sessionId: string, userId: string) {
  try {
    const session = await redisSessionStore.resetSessionVotes(sessionId, userId);
    
    if (session) {
      await broadcastToSession(sessionId, {
        type: 'session_update',
        sessionId,
        data: session,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Failed to handle reset:', error);
  }
}

// 处理模板更新
async function handleTemplateUpdate(sessionId: string, userId: string, templateData: { type: string; customCards?: string }) {
  try {
    const session = await redisSessionStore.updateSessionTemplate(
      sessionId,
      userId,
      templateData.type,
      templateData.customCards
    );
    
    if (session) {
      await broadcastToSession(sessionId, {
        type: 'session_update',
        sessionId,
        data: session,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Failed to handle template update:', error);
  }
}

// 广播消息到会话中的所有用户
async function broadcastToSession(sessionId: string, message: Record<string, unknown>) {
  try {
    // 使用连接池广播
    await connectionPool.broadcastToSession(sessionId, message);
  } catch (error) {
    console.error('Failed to broadcast to session:', error);
  }
}

// 发送消息给特定用户
async function sendToUser(userId: string, message: Record<string, unknown>) {
  try {
    const sent = await connectionPool.sendToUser(userId, message);
    if (!sent) {
      console.warn(`User ${userId} not found or connection closed`);
    }
  } catch (error) {
    console.error('Failed to send message to user:', error);
  }
}

// HTTP处理函数（用于WebSocket升级）
export async function GET(_request: NextRequest) {
  // 这个路由主要用于WebSocket升级
  // 实际的WebSocket处理在initWebSocketServer中
  console.log('WebSocket endpoint', _request);
  return new Response('WebSocket endpoint', { status: 200 });
}

// 导出WebSocket相关函数供其他模块使用
export { initWebSocketServer, broadcastToSession, sendToUser }; 