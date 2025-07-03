import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// WebSocket服务器实例
let wss: WebSocketServer | null = null;

// 会话连接映射
const sessionConnections = new Map<string, Set<WebSocket>>();
const userConnections = new Map<string, WebSocket>();

// 初始化WebSocket服务器
function initWebSocketServer() {
  if (wss) return wss;

  // 在开发环境中，我们需要手动创建WebSocket服务器
  // 在生产环境中，建议使用专门的WebSocket服务
  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    console.log('WebSocket client connected');

    // 解析连接参数
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');

    if (!sessionId || !userId) {
      ws.close(1008, 'Missing sessionId or userId');
      return;
    }

    // 存储连接
    if (!sessionConnections.has(sessionId)) {
      sessionConnections.set(sessionId, new Set());
    }
    sessionConnections.get(sessionId)!.add(ws);
    userConnections.set(userId, ws);

    // 设置连接元数据
    (ws as WebSocket & { sessionId: string; userId: string }).sessionId = sessionId;
    (ws as WebSocket & { sessionId: string; userId: string }).userId = userId;

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleWebSocketMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      const sessionId = (ws as WebSocket & { sessionId: string; userId: string }).sessionId;
      const userId = (ws as WebSocket & { sessionId: string; userId: string }).userId;

      if (sessionId && sessionConnections.has(sessionId)) {
        sessionConnections.get(sessionId)!.delete(ws);
        if (sessionConnections.get(sessionId)!.size === 0) {
          sessionConnections.delete(sessionId);
        }
      }

      if (userId) {
        userConnections.delete(userId);
      }
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
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
function handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage) {
  const sessionId = (ws as WebSocket & { sessionId: string; userId: string }).sessionId;
  const userId = (ws as WebSocket & { sessionId: string; userId: string }).userId;

  switch (message.type) {
    case 'heartbeat':
      // 处理心跳
      broadcastToSession(sessionId, {
        type: 'heartbeat_ack',
        sessionId,
        userId,
        timestamp: Date.now()
      });
      break;

    case 'vote':
      // 处理投票
      if (message.data?.vote) {
        handleVote(sessionId, userId, message.data.vote);
      }
      break;

    case 'reveal':
      // 处理显示投票
      handleReveal(sessionId, userId);
      break;

    case 'reset':
      // 处理重置投票
      handleReset(sessionId, userId);
      break;

    case 'template_update':
      // 处理模板更新
      if (message.data?.type) {
        handleTemplateUpdate(sessionId, userId, {
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
    const { updateUserVote } = await import('@/lib/session-store');
    const session = updateUserVote(sessionId, userId, vote);
    
    if (session) {
      broadcastToSession(sessionId, {
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
    const { revealSessionVotes } = await import('@/lib/session-store');
    const session = revealSessionVotes(sessionId, userId);
    
    if (session) {
      broadcastToSession(sessionId, {
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
    const { resetSessionVotes } = await import('@/lib/session-store');
    const session = resetSessionVotes(sessionId, userId);
    
    if (session) {
      broadcastToSession(sessionId, {
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
    const { updateSessionTemplate } = await import('@/lib/session-store');
    const session = updateSessionTemplate(
      sessionId,
      userId,
      templateData.type,
      templateData.customCards
    );
    
    if (session) {
      broadcastToSession(sessionId, {
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
function broadcastToSession(sessionId: string, message: Record<string, unknown>) {
  const connections = sessionConnections.get(sessionId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

// 发送消息给特定用户
function sendToUser(userId: string, message: Record<string, unknown>) {
  const ws = userConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
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