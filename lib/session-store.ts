// Server-side session storage
export type UserRole = "host" | "attendance" | "guest";

interface User {
  id: string;
  name: string;
  role: UserRole;
  vote: string | null;
  hasVoted: boolean;
  lastSeen: number;
}

interface Session {
  id: string;
  users: User[];
  revealed: boolean;
  votes: Record<string, string>;
  createdAt: number;
  hostId: string; // 添加host ID字段
  template: {
    type: string;
    customCards?: string;
  };
}

// In-memory storage (in production, use Redis or database)
const sessions = new Map<string, Session>();

export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Clean up inactive users (not seen for 30 seconds)
  const now = Date.now();
  const activeUsers = session.users.filter(
    (user) => now - user.lastSeen < 30000
  );

  if (activeUsers.length !== session.users.length) {
    const updatedSession = { ...session, users: activeUsers };
    sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  return session;
}

export function createSession(
  sessionId: string,
  userId: string,
  userName: string
): Session {
  const now = Date.now();

  const hostUser: User = {
    id: userId,
    name: userName,
    role: "host",
    vote: null,
    hasVoted: false,
    lastSeen: now,
  };

  const newSession: Session = {
    id: sessionId,
    users: [hostUser],
    revealed: false,
    votes: {},
    createdAt: now,
    hostId: userId,
    template: {
      type: "fibonacci",
      customCards: "☕️,1,2,3,5,8,13",
    },
  };

  sessions.set(sessionId, newSession);
  return newSession;
}

export function joinSession(
  sessionId: string,
  userId: string,
  userName: string,
  role: UserRole
): Session {
  const existingSession = getSession(sessionId);
  const now = Date.now();

  if (!existingSession) {
    throw new Error("Session not found");
  }

  const newUser: User = {
    id: userId,
    name: userName,
    role,
    vote: null,
    hasVoted: false,
    lastSeen: now,
  };

  // Remove existing user with same ID and add new one
  const otherUsers = existingSession.users.filter((user) => user.id !== userId);
  const updatedSession = {
    ...existingSession,
    users: [...otherUsers, newUser],
  };
  sessions.set(sessionId, updatedSession);
  return updatedSession;
}

// 保持向后兼容的函数
export function createOrJoinSession(
  sessionId: string,
  userId: string,
  userName: string
): Session {
  const existingSession = getSession(sessionId);

  if (existingSession) {
    return joinSession(sessionId, userId, userName, "attendance");
  } else {
    return createSession(sessionId, userId, userName);
  }
}

export function updateUserVote(
  sessionId: string,
  userId: string,
  vote: string
): Session | null {
  const session = getSession(sessionId);
  if (!session) return null;

  // host和attendance角色都可以投票
  const user = session.users.find((u) => u.id === userId);
  if (!user || (user.role !== "attendance" && user.role !== "host")) {
    return session;
  }

  const updatedUsers = session.users.map((user) =>
    user.id === userId
      ? { ...user, vote, hasVoted: true, lastSeen: Date.now() }
      : user
  );

  const updatedVotes = { ...session.votes, [userId]: vote };

  const updatedSession = {
    ...session,
    users: updatedUsers,
    votes: updatedVotes,
  };

  sessions.set(sessionId, updatedSession);
  return updatedSession;
}

export function revealSessionVotes(
  sessionId: string,
  userId: string
): Session | null {
  const session = getSession(sessionId);
  if (!session) return null;

  // 只有host可以reveal votes
  if (session.hostId !== userId) {
    return session;
  }

  const updatedSession = { ...session, revealed: true };
  sessions.set(sessionId, updatedSession);
  return updatedSession;
}

export function resetSessionVotes(
  sessionId: string,
  userId: string
): Session | null {
  const session = getSession(sessionId);
  if (!session) return null;

  // 只有host可以reset votes
  if (session.hostId !== userId) {
    return session;
  }

  const updatedUsers = session.users.map((user) => ({
    ...user,
    vote: null,
    hasVoted: false,
    lastSeen: Date.now(),
  }));

  const updatedSession = {
    ...session,
    users: updatedUsers,
    votes: {},
    revealed: false,
  };

  sessions.set(sessionId, updatedSession);
  return updatedSession;
}

export function updateUserHeartbeat(
  sessionId: string,
  userId: string
): Session | null {
  const session = getSession(sessionId);
  if (!session) return null;

  const updatedUsers = session.users.map((user) =>
    user.id === userId ? { ...user, lastSeen: Date.now() } : user
  );

  const updatedSession = { ...session, users: updatedUsers };
  sessions.set(sessionId, updatedSession);
  return updatedSession;
}

export function updateSessionTemplate(
  sessionId: string,
  userId: string,
  templateType: string,
  customCards?: string
): Session | null {
  const session = getSession(sessionId);
  if (!session) return null;

  // 只有host可以更新模板设置
  if (session.hostId !== userId) {
    return session;
  }

  const updatedSession = {
    ...session,
    template: {
      type: templateType,
      customCards,
    },
  };

  sessions.set(sessionId, updatedSession);
  return updatedSession;
}

// 检查用户是否为host
export function isHost(sessionId: string, userId: string): boolean {
  const session = getSession(sessionId);
  return session?.hostId === userId;
}

// 检查用户是否可以投票
export function canVote(sessionId: string, userId: string): boolean {
  const session = getSession(sessionId);
  const user = session?.users.find((u) => u.id === userId);
  return user?.role === "attendance" || user?.role === "host";
}

// 本地存储相关的工具函数
interface StoredUserInfo {
  userId: string;
  userName: string;
  sessionId: string;
  role: UserRole;
  timestamp: number;
}

const STORAGE_KEY = "estimation_tool_user_info";
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时过期

export function saveUserInfoToStorage(
  userId: string,
  userName: string,
  sessionId: string,
  role: UserRole
): void {
  if (typeof window === "undefined") return;

  const userInfo: StoredUserInfo = {
    userId,
    userName,
    sessionId,
    role,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
  } catch (error) {
    console.error("Failed to save user info to localStorage:", error);
  }
}

export function getUserInfoFromStorage(): StoredUserInfo | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const userInfo: StoredUserInfo = JSON.parse(stored);

    // 检查是否过期
    if (Date.now() - userInfo.timestamp > STORAGE_EXPIRY) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return userInfo;
  } catch (error) {
    console.error("Failed to get user info from localStorage:", error);
    return null;
  }
}

export function clearUserInfoFromStorage(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear user info from localStorage:", error);
  }
}
