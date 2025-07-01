"use server"

import {
  createOrJoinSession,
  getSession,
  updateUserVote,
  revealSessionVotes,
  resetSessionVotes,
  updateUserHeartbeat,
} from "@/lib/session-store"

export async function joinSession(sessionId: string, userId: string, userName: string) {
  try {
    const session = createOrJoinSession(sessionId, userId, userName)
    return { success: true, session }
  } catch {
    return { success: false, error: "Failed to join session" }
  }
}

export async function getSessionData(sessionId: string) {
  try {
    const session = getSession(sessionId)
    return { success: true, session }
  } catch {
    return { success: false, error: "Failed to get session data" }
  }
}

export async function castVote(sessionId: string, userId: string, vote: string) {
  try {
    const session = updateUserVote(sessionId, userId, vote)
    return { success: true, session }
  } catch {
    return { success: false, error: "Failed to cast vote" }
  }
}

export async function revealVotes(sessionId: string) {
  try {
    const session = revealSessionVotes(sessionId)
    return { success: true, session }
  } catch {
    return { success: false, error: "Failed to reveal votes" }
  }
}

export async function resetVotes(sessionId: string) {
  try {
    const session = resetSessionVotes(sessionId)
    return { success: true, session }
  } catch {
    return { success: false, error: "Failed to reset votes" }
  }
}

export async function heartbeat(sessionId: string, userId: string) {
  try {
    const session = updateUserHeartbeat(sessionId, userId)
    return { success: true, session }
  } catch {
    return { success: false, error: "Failed to update heartbeat" }
  }
}
