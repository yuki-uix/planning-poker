"use server";

import { UserRole } from "@/lib/session-store";
import { redisSessionStore } from "@/lib/redis-session-store";
import { v4 as uuidv4 } from "uuid";

export async function createSessionWithAutoId(
  userId: string,
  userName: string
) {
  try {
    const sessionId = uuidv4();
    const session = await redisSessionStore.createSession(sessionId, userId, userName);
    return { success: true, session, sessionId };
  } catch (error) {
    console.error('Failed to create session with auto ID:', error);
    return { success: false, error: "Failed to create session" };
  }
}

export async function createNewSession(
  sessionId: string,
  userId: string,
  userName: string
) {
  try {
    const session = await redisSessionStore.createSession(sessionId, userId, userName);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to create session" };
  }
}

export async function joinSessionAsRole(
  sessionId: string,
  userId: string,
  userName: string,
  role: UserRole
) {
  try {
    const session = await redisSessionStore.joinSession(sessionId, userId, userName, role);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to join session" };
  }
}

// 保持向后兼容的函数
export async function joinSessionLegacy(
  sessionId: string,
  userId: string,
  userName: string
) {
  try {
    const session = await redisSessionStore.joinSession(
      sessionId,
      userId,
      userName,
      "attendance"
    );
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to join session" };
  }
}

export async function getSessionData(sessionId: string) {
  try {
    const session = await redisSessionStore.getSession(sessionId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to get session data" };
  }
}

export async function castVote(
  sessionId: string,
  userId: string,
  vote: string
) {
  try {
    const session = await redisSessionStore.updateUserVote(sessionId, userId, vote);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to cast vote" };
  }
}

export async function revealVotes(sessionId: string, userId: string) {
  try {
    const session = await redisSessionStore.revealSessionVotes(sessionId, userId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to reveal votes" };
  }
}

export async function resetVotes(sessionId: string, userId: string) {
  try {
    const session = await redisSessionStore.resetSessionVotes(sessionId, userId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to reset votes" };
  }
}

export async function heartbeat(sessionId: string, userId: string) {
  try {
    const session = await redisSessionStore.updateUserHeartbeat(sessionId, userId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to update heartbeat" };
  }
}

export async function updateTemplate(
  sessionId: string,
  userId: string,
  templateType: string,
  customCards?: string
) {
  try {
    const session = await redisSessionStore.updateSessionTemplate(
      sessionId,
      userId,
      templateType,
      customCards
    );
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to update template" };
  }
}

export async function transferHost(
  sessionId: string,
  currentHostId: string
) {
  try {
    const session = await redisSessionStore.transferHostRole(sessionId, currentHostId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to transfer host role" };
  }
}

// 新增：用户离开会话
export async function leaveSession(
  sessionId: string,
  userId: string
) {
  try {
    // 在开发环境中使用内存版本的session store
    if (process.env.NODE_ENV === 'development') {
      const { removeUserFromSession } = await import('@/lib/session-store');
      const session = removeUserFromSession(sessionId, userId);
      return { success: true, session };
    } else {
      const session = await redisSessionStore.removeUserFromSession(sessionId, userId);
      return { success: true, session };
    }
  } catch {
    return { success: false, error: "Failed to leave session" };
  }
}

// 新增：用户心跳 - 保持会话活跃
export async function userHeartbeat(
  sessionId: string,
  userId: string
) {
  try {
    const session = await redisSessionStore.updateUserHeartbeat(sessionId, userId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to update heartbeat" };
  }
}
