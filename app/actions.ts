"use server";

import { redisSessionStore, UserRole } from "../lib/redis-session-store";
import { authStore } from "../lib/auth-store";
import { v4 as uuidv4 } from "uuid";

export async function createSessionWithAutoId(
  userId: string,
  userName: string
) {
  try {
    const sessionId = uuidv4();
    const session = await redisSessionStore.createSession(sessionId, userId, userName);
    
    // Create authentication session for the host
    await authStore.createAuthSession(userId, userName, sessionId, "host");
    
    return { success: true, session, sessionId };
  } catch {
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
    
    // Create authentication session for the host
    await authStore.createAuthSession(userId, userName, sessionId, "host");
    
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
    
    // Create authentication session for the user
    await authStore.createAuthSession(userId, userName, sessionId, role);
    
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
    const session = await joinSessionAsRole(
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
    // Find the first attendance user to transfer to
    const existingSession = await redisSessionStore.getSession(sessionId);
    if (!existingSession) {
      return { success: false, error: "Session not found" };
    }
    
    const firstAttendance = existingSession.users.find(
      (user) => user.role === "attendance" && user.id !== currentHostId
    );
    
    if (!firstAttendance) {
      return { success: false, error: "No attendance user to transfer host to" };
    }
    
    const session = await redisSessionStore.transferHostRole(sessionId, currentHostId, firstAttendance.id);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to transfer host role" };
  }
}

// New authentication-related actions
export async function restoreUserAuthentication() {
  try {
    const result = await authStore.restoreUserSession();
    if (result.success) {
      return {
        success: true,
        userId: result.userId,
        userName: result.userName,
        sessionId: result.sessionId,
        role: result.role,
        isHost: result.isHost
      };
    }
    return { success: false };
  } catch {
    return { success: false, error: "Failed to restore authentication" };
  }
}

export async function clearAuthentication() {
  try {
    await authStore.clearAuthSession();
    return { success: true };
  } catch {
    return { success: false, error: "Failed to clear authentication" };
  }
}

export async function verifyUserSession(
  userId: string,
  sessionId: string,
  requiredRole?: UserRole
) {
  try {
    const verification = await authStore.verifyUserPermission(
      userId,
      sessionId,
      requiredRole
    );
    return { success: verification.valid, ...verification };
  } catch {
    return { success: false, error: "Failed to verify user session" };
  }
}
