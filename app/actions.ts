"use server";

import {
  createSession,
  joinSession,
  getSession,
  updateUserVote,
  revealSessionVotes,
  resetSessionVotes,
  updateUserHeartbeat,
  updateSessionTemplate,
  transferHostRole,
  UserRole,
} from "../lib/session-store";
import { v4 as uuidv4 } from "uuid";

export async function createSessionWithAutoId(
  userId: string,
  userName: string
) {
  try {
    const sessionId = uuidv4();
    const session = createSession(sessionId, userId, userName);
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
    const session = createSession(sessionId, userId, userName);
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
    const session = joinSession(sessionId, userId, userName, role);
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
    const session = joinSessionAsRole(
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
    const session = getSession(sessionId);
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
    const session = updateUserVote(sessionId, userId, vote);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to cast vote" };
  }
}

export async function revealVotes(sessionId: string, userId: string) {
  try {
    const session = revealSessionVotes(sessionId, userId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to reveal votes" };
  }
}

export async function resetVotes(sessionId: string, userId: string) {
  try {
    const session = resetSessionVotes(sessionId, userId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to reset votes" };
  }
}

export async function heartbeat(sessionId: string, userId: string) {
  try {
    const session = updateUserHeartbeat(sessionId, userId);
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
    const session = updateSessionTemplate(
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
    const session = transferHostRole(sessionId, currentHostId);
    return { success: true, session };
  } catch {
    return { success: false, error: "Failed to transfer host role" };
  }
}
