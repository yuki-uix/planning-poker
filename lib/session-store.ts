// Server-side session storage
interface User {
  id: string
  name: string
  vote: string | null
  hasVoted: boolean
  lastSeen: number
}

interface Session {
  id: string
  users: User[]
  revealed: boolean
  votes: Record<string, string>
  createdAt: number
}

// In-memory storage (in production, use Redis or database)
const sessions = new Map<string, Session>()

export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId)
  if (!session) return null

  // Clean up inactive users (not seen for 30 seconds)
  const now = Date.now()
  const activeUsers = session.users.filter((user) => now - user.lastSeen < 30000)

  if (activeUsers.length !== session.users.length) {
    const updatedSession = { ...session, users: activeUsers }
    sessions.set(sessionId, updatedSession)
    return updatedSession
  }

  return session
}

export function createOrJoinSession(sessionId: string, userId: string, userName: string): Session {
  const existingSession = getSession(sessionId)
  const now = Date.now()

  const newUser: User = {
    id: userId,
    name: userName,
    vote: null,
    hasVoted: false,
    lastSeen: now,
  }

  if (existingSession) {
    // Remove existing user with same ID and add new one
    const otherUsers = existingSession.users.filter((user) => user.id !== userId)
    const updatedSession = {
      ...existingSession,
      users: [...otherUsers, newUser],
    }
    sessions.set(sessionId, updatedSession)
    return updatedSession
  } else {
    // Create new session
    const newSession: Session = {
      id: sessionId,
      users: [newUser],
      revealed: false,
      votes: {},
      createdAt: now,
    }
    sessions.set(sessionId, newSession)
    return newSession
  }
}

export function updateUserVote(sessionId: string, userId: string, vote: string): Session | null {
  const session = getSession(sessionId)
  if (!session) return null

  const updatedUsers = session.users.map((user) =>
    user.id === userId ? { ...user, vote, hasVoted: true, lastSeen: Date.now() } : user,
  )

  const updatedVotes = { ...session.votes, [userId]: vote }

  const updatedSession = {
    ...session,
    users: updatedUsers,
    votes: updatedVotes,
  }

  sessions.set(sessionId, updatedSession)
  return updatedSession
}

export function revealSessionVotes(sessionId: string): Session | null {
  const session = getSession(sessionId)
  if (!session) return null

  const updatedSession = { ...session, revealed: true }
  sessions.set(sessionId, updatedSession)
  return updatedSession
}

export function resetSessionVotes(sessionId: string): Session | null {
  const session = getSession(sessionId)
  if (!session) return null

  const updatedUsers = session.users.map((user) => ({
    ...user,
    vote: null,
    hasVoted: false,
    lastSeen: Date.now(),
  }))

  const updatedSession = {
    ...session,
    users: updatedUsers,
    votes: {},
    revealed: false,
  }

  sessions.set(sessionId, updatedSession)
  return updatedSession
}

export function updateUserHeartbeat(sessionId: string, userId: string): Session | null {
  const session = getSession(sessionId)
  if (!session) return null

  const updatedUsers = session.users.map((user) => (user.id === userId ? { ...user, lastSeen: Date.now() } : user))

  const updatedSession = { ...session, users: updatedUsers }
  sessions.set(sessionId, updatedSession)
  return updatedSession
}
