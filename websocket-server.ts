import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { redisSessionStore } from "./lib/redis-session-store";
import { connectionPool } from "./lib/connection-pool";
import { heartbeatManager } from "./lib/heartbeat-manager";
import { authStore } from "./lib/auth-store";

const PORT = process.env.PORT || 3001;

// 创建 HTTP 服务器
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("healthy");
    return;
  }

  res.writeHead(404);
  res.end();
});

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server });

// 最大连接数限制 - 为6-8用户优化
const MAX_CONNECTIONS_PER_SESSION = parseInt(
  process.env.MAX_CONNECTIONS_PER_SESSION || "15" // 每用户可能多个连接(页面重载等)
);

// 生成连接ID
function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// WebSocket消息类型定义
interface WebSocketMessage {
  type: "heartbeat" | "vote" | "reveal" | "reset" | "template_update";
  sessionId: string;
  userId: string;
  data?: {
    vote?: string;
    type?: string;
    customCards?: string;
  };
  timestamp?: number;
}

wss.on("connection", async (ws: WebSocket, request) => {
  console.log("WebSocket client connected");

  // 解析连接参数
  const url = new URL(request.url!, `http://${request.headers.host}`);
  const sessionId = url.searchParams.get("sessionId");
  const userId = url.searchParams.get("userId");
  const authToken = url.searchParams.get("authToken");

  if (!sessionId || !userId) {
    ws.close(1008, "Missing sessionId or userId");
    return;
  }

  // Verify authentication
  try {
    let authSession = null;
    if (authToken) {
      authSession = await authStore.getAuthSession(authToken);
    } else {
      // Try to get from cookie (if available in request headers)
      const cookieHeader = request.headers.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
        
        const cookieToken = cookies['planning_poker_auth'];
        if (cookieToken) {
          authSession = await authStore.getAuthSession(cookieToken);
        }
      }
    }

    // Verify user permission for the session
    const verification = await authStore.verifyUserPermission(userId, sessionId);
    if (!verification.valid) {
      ws.close(1008, "Invalid user authentication or session permission");
      return;
    }

    console.log(`Authenticated WebSocket connection for user ${userId} in session ${sessionId} with role ${verification.role}`);
  } catch (error) {
    console.error("WebSocket authentication failed:", error);
    ws.close(1008, "Authentication failed");
    return;
  }

  // 检查连接数量限制 - 改进的连接管理
  const currentConnections =
    connectionPool.getSessionConnectionCount(sessionId);
  if (currentConnections >= MAX_CONNECTIONS_PER_SESSION) {
    console.warn(
      `Session ${sessionId} connection limit reached (${currentConnections}/${MAX_CONNECTIONS_PER_SESSION}), attempting graceful handling`
    );
    
    // 尝试清理无效连接后再次检查
    connectionPool.performHealthCheck();
    const connectionsAfterCleanup = connectionPool.getSessionConnectionCount(sessionId);
    
    if (connectionsAfterCleanup >= MAX_CONNECTIONS_PER_SESSION) {
      ws.close(1013, "Session at capacity - please retry in a moment");
      return;
    }
  }

  // 生成连接ID
  const connectionId = generateConnectionId();

  // 注册连接到池
  const added = connectionPool.addConnection(sessionId, ws, {
    sessionId,
    userId,
    connectionId,
  });

  if (!added) {
    ws.close(1013, "Connection pool is full");
    return;
  }

  // 设置连接元数据
  (
    ws as WebSocket & {
      sessionId: string;
      userId: string;
      connectionId: string;
    }
  ).sessionId = sessionId;
  (
    ws as WebSocket & {
      sessionId: string;
      userId: string;
      connectionId: string;
    }
  ).userId = userId;
  (
    ws as WebSocket & {
      sessionId: string;
      userId: string;
      connectionId: string;
    }
  ).connectionId = connectionId;

  // 注册到Redis
  try {
    await redisSessionStore.addConnection(sessionId, userId, connectionId);
  } catch (error) {
    console.error("Failed to register connection in Redis:", error);
  }

  // 开始心跳
  heartbeatManager.startHeartbeat(userId, ws);

  ws.on("message", async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      await handleWebSocketMessage(ws, message);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  });

  ws.on("close", async () => {
    console.log("WebSocket client disconnected");
    const sessionId = (
      ws as WebSocket & {
        sessionId: string;
        userId: string;
        connectionId: string;
      }
    ).sessionId;
    const userId = (
      ws as WebSocket & {
        sessionId: string;
        userId: string;
        connectionId: string;
      }
    ).userId;
    const connectionId = (
      ws as WebSocket & {
        sessionId: string;
        userId: string;
        connectionId: string;
      }
    ).connectionId;

    // 停止心跳
    heartbeatManager.stopHeartbeat(userId);

    // 从连接池移除
    if (sessionId) {
      connectionPool.removeConnection(sessionId, ws);
    }

    // 从Redis移除
    if (sessionId && userId && connectionId) {
      try {
        await redisSessionStore.removeConnection(
          sessionId,
          userId,
          connectionId
        );
      } catch (error) {
        console.error("Failed to remove connection from Redis:", error);
      }
    }
  });

  ws.on("error", (error: Error) => {
    console.error("WebSocket error:", error);
  });
});

// 处理WebSocket消息
async function handleWebSocketMessage(
  ws: WebSocket,
  message: WebSocketMessage
) {
  const sessionId = (
    ws as WebSocket & {
      sessionId: string;
      userId: string;
      connectionId: string;
    }
  ).sessionId;
  const userId = (
    ws as WebSocket & {
      sessionId: string;
      userId: string;
      connectionId: string;
    }
  ).userId;

  switch (message.type) {
    case "heartbeat":
      // 处理心跳
      heartbeatManager.handleHeartbeatResponse(userId);
      await broadcastToSession(sessionId, {
        type: "heartbeat_ack",
        sessionId,
        userId,
        timestamp: Date.now(),
      });
      break;

    case "vote":
      // 处理投票
      if (message.data?.vote) {
        await handleVote(sessionId, userId, message.data.vote);
      }
      break;

    case "reveal":
      // 处理显示投票
      await handleReveal(sessionId, userId);
      break;

    case "reset":
      // 处理重置投票
      await handleReset(sessionId, userId);
      break;

    case "template_update":
      // 处理模板更新
      if (message.data?.type) {
        await handleTemplateUpdate(sessionId, userId, {
          type: message.data.type,
          customCards: message.data.customCards,
        });
      }
      break;

    default:
      console.warn("Unknown message type:", message.type);
  }
}

// 处理投票
async function handleVote(sessionId: string, userId: string, vote: string) {
  try {
    const session = await redisSessionStore.updateUserVote(
      sessionId,
      userId,
      vote
    );

    if (session) {
      await broadcastToSession(sessionId, {
        type: "session_update",
        sessionId,
        data: session,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error("Failed to handle vote:", error);
  }
}

// 处理显示投票
async function handleReveal(sessionId: string, userId: string) {
  try {
    const session = await redisSessionStore.revealSessionVotes(
      sessionId,
      userId
    );

    if (session) {
      await broadcastToSession(sessionId, {
        type: "session_update",
        sessionId,
        data: session,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error("Failed to handle reveal:", error);
  }
}

// 处理重置投票
async function handleReset(sessionId: string, userId: string) {
  try {
    const session = await redisSessionStore.resetSessionVotes(
      sessionId,
      userId
    );

    if (session) {
      await broadcastToSession(sessionId, {
        type: "session_update",
        sessionId,
        data: session,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error("Failed to handle reset:", error);
  }
}

// 处理模板更新
async function handleTemplateUpdate(
  sessionId: string,
  userId: string,
  templateData: { type: string; customCards?: string }
) {
  try {
    const session = await redisSessionStore.updateSessionTemplate(
      sessionId,
      userId,
      templateData.type,
      templateData.customCards
    );

    if (session) {
      await broadcastToSession(sessionId, {
        type: "session_update",
        sessionId,
        data: session,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error("Failed to handle template update:", error);
  }
}

// 广播消息到会话中的所有用户
async function broadcastToSession(
  sessionId: string,
  message: Record<string, unknown>
) {
  try {
    // 使用连接池广播
    await connectionPool.broadcastToSession(sessionId, message);
  } catch (error) {
    console.error("Failed to broadcast to session:", error);
  }
}

// 启动服务器
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
