// 持久化存储工具
// 提供更稳定的数据存储机制，包括错误处理、重试机制和数据验证

export interface PersistentData {
  userId: string;
  userName: string;
  sessionId: string;
  role: "host" | "attendance" | "guest";
  timestamp: number;
  lastVote?: string | null;
  lastSessionState?: {
    revealed: boolean;
    template: {
      type: string;
      customCards?: string;
    };
  };
  version: string; // 数据版本，用于兼容性检查
}

const STORAGE_KEYS = {
  USER_INFO: "estimation_tool_user_info_v2",
  SESSION_STATE: "estimation_tool_session_state_v2",
  BACKUP: "estimation_tool_backup_v2",
} as const;

const DATA_VERSION = "2.0.0";
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时过期
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 100; // 毫秒

// 检查浏览器是否支持localStorage
function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const test = "__localStorage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// 带重试机制的存储操作
async function withRetry<T>(
  operation: () => T,
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * attempt)
        );
      }
    }
  }

  throw lastError!;
}

// 数据验证
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateData(data: any): data is PersistentData {
  if (!data || typeof data !== "object") return false;

  const requiredFields = [
    "userId",
    "userName",
    "sessionId",
    "role",
    "timestamp",
    "version",
  ];
  for (const field of requiredFields) {
    if (!(field in data)) return false;
  }

  if (typeof data.userId !== "string" || data.userId.length === 0) return false;
  if (typeof data.userName !== "string" || data.userName.length === 0)
    return false;
  if (typeof data.sessionId !== "string" || data.sessionId.length === 0)
    return false;
  if (!["host", "attendance", "guest"].includes(data.role)) return false;
  if (typeof data.timestamp !== "number" || data.timestamp <= 0) return false;
  if (typeof data.version !== "string") return false;

  return true;
}

// 检查数据是否过期
function isDataExpired(timestamp: number): boolean {
  return Date.now() - timestamp > STORAGE_EXPIRY;
}

// 清理过期数据
function cleanupExpiredData(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.timestamp && isDataExpired(parsed.timestamp)) {
            localStorage.removeItem(key);
          }
        } catch {
          // 如果解析失败，删除损坏的数据
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.error("Failed to cleanup expired data:", error);
  }
}

// 保存用户数据
export async function saveUserData(
  data: Omit<PersistentData, "timestamp" | "version">
): Promise<void> {
  if (!isLocalStorageAvailable()) {
    console.warn("localStorage is not available");
    return;
  }

  cleanupExpiredData();

  const persistentData: PersistentData = {
    ...data,
    timestamp: Date.now(),
    version: DATA_VERSION,
  };

  try {
    await withRetry(() => {
      localStorage.setItem(
        STORAGE_KEYS.USER_INFO,
        JSON.stringify(persistentData)
      );

      // 同时保存备份
      localStorage.setItem(
        STORAGE_KEYS.BACKUP,
        JSON.stringify({
          ...persistentData,
          timestamp: Date.now(),
        })
      );
    });
  } catch (error) {
    console.error("Failed to save user data:", error);
    throw error;
  }
}

// 获取用户数据
export async function getUserData(): Promise<PersistentData | null> {
  if (!isLocalStorageAvailable()) return null;

  try {
    const data = await withRetry(() => {
      // 首先尝试从主存储获取
      let stored = localStorage.getItem(STORAGE_KEYS.USER_INFO);

      // 如果主存储失败，尝试从备份恢复
      if (!stored) {
        stored = localStorage.getItem(STORAGE_KEYS.BACKUP);
        if (stored) {
          console.log("Recovered data from backup");
        }
      }

      return stored;
    });

    if (!data) return null;

    const parsed = JSON.parse(data);

    if (!validateData(parsed)) {
      console.warn("Invalid data format, clearing storage");
      clearAllData();
      return null;
    }

    if (isDataExpired(parsed.timestamp)) {
      console.log("Data expired, clearing storage");
      clearAllData();
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to get user data:", error);
    return null;
  }
}

// 更新用户投票
export async function updateUserVote(vote: string | null): Promise<void> {
  if (!isLocalStorageAvailable()) return;

  try {
    const currentData = await getUserData();
    if (!currentData) return;

    await saveUserData({
      ...currentData,
      lastVote: vote,
    });
  } catch (error) {
    console.error("Failed to update user vote:", error);
  }
}

// 更新会话状态
export async function updateSessionState(
  sessionId: string,
  sessionState: {
    revealed: boolean;
    template: {
      type: string;
      customCards?: string;
    };
  }
): Promise<void> {
  if (!isLocalStorageAvailable()) return;

  try {
    const currentData = await getUserData();
    if (!currentData || currentData.sessionId !== sessionId) return;

    await saveUserData({
      ...currentData,
      lastSessionState: sessionState,
    });

    // 同时保存独立的会话状态
    await withRetry(() => {
      localStorage.setItem(
        STORAGE_KEYS.SESSION_STATE,
        JSON.stringify({
          sessionId,
          state: sessionState,
          timestamp: Date.now(),
          version: DATA_VERSION,
        })
      );
    });
  } catch (error) {
    console.error("Failed to update session state:", error);
  }
}

// 获取会话状态
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSessionState(sessionId: string): Promise<any> {
  if (!isLocalStorageAvailable()) return null;

  try {
    const data = await withRetry(() =>
      localStorage.getItem(STORAGE_KEYS.SESSION_STATE)
    );
    if (!data) return null;

    const parsed = JSON.parse(data);

    if (parsed.sessionId !== sessionId || isDataExpired(parsed.timestamp)) {
      localStorage.removeItem(STORAGE_KEYS.SESSION_STATE);
      return null;
    }

    return parsed.state;
  } catch (error) {
    console.error("Failed to get session state:", error);
    return null;
  }
}

// 清除所有数据
export function clearAllData(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error("Failed to clear all data:", error);
  }
}

// 获取存储使用情况
export function getStorageInfo(): {
  available: boolean;
  used: number;
  total: number;
  percentage: number;
} {
  if (!isLocalStorageAvailable()) {
    return {
      available: false,
      used: 0,
      total: 0,
      percentage: 0,
    };
  }

  try {
    let used = 0;
    Object.values(STORAGE_KEYS).forEach((key) => {
      const data = localStorage.getItem(key);
      if (data) {
        used += new Blob([data]).size;
      }
    });

    // 估算总容量（通常为5-10MB）
    const total = 5 * 1024 * 1024; // 5MB
    const percentage = (used / total) * 100;

    return {
      available: true,
      used,
      total,
      percentage,
    };
  } catch (error) {
    console.error("Failed to get storage info:", error);
    return {
      available: false,
      used: 0,
      total: 0,
      percentage: 0,
    };
  }
}

// 数据迁移工具（从旧版本迁移到新版本）
export async function migrateFromOldStorage(): Promise<void> {
  if (!isLocalStorageAvailable()) return;

  try {
    const oldKeys = [
      "estimation_tool_user_info",
      "estimation_tool_session_state",
    ];

    for (const oldKey of oldKeys) {
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData);

          // 迁移用户信息
          if (oldKey === "estimation_tool_user_info" && parsed.userId) {
            await saveUserData({
              userId: parsed.userId,
              userName: parsed.userName || "",
              sessionId: parsed.sessionId || "",
              role: parsed.role || "attendance",
              lastVote: parsed.lastVote,
              lastSessionState: parsed.lastSessionState,
            });
          }

          // 迁移会话状态
          if (oldKey === "estimation_tool_session_state" && parsed.sessionId) {
            await updateSessionState(parsed.sessionId, parsed.state);
          }

          // 删除旧数据
          localStorage.removeItem(oldKey);
        } catch (error) {
          console.error(`Failed to migrate data from ${oldKey}:`, error);
          localStorage.removeItem(oldKey);
        }
      }
    }
  } catch (error) {
    console.error("Failed to migrate from old storage:", error);
  }
}
