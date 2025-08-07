import { useState, useCallback, useEffect } from "react";
import { Session } from "../../../types/estimation";
import { getSessionData, heartbeat } from "../../../app/actions";
import { updateSessionState } from "../../../lib/persistence";

export interface SessionState {
  session: Session | null;
  isJoined: boolean;
  isConnected: boolean;
  isLoading: boolean;
}

export interface SessionStateHandlers {
  setSession: (session: Session | null) => void;
  setIsJoined: (joined: boolean) => void;
  setIsConnected: (connected: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  pollSession: () => Promise<void>;
  sendHeartbeat: () => Promise<void>;
}

export function useSessionState(
  sessionId: string,
  currentUser: string,
  isJoined: boolean,
  isRestoring: boolean,
  setIsJoined: (joined: boolean) => void
): SessionState & SessionStateHandlers {
  const [session, setSession] = useState<Session | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 同步isJoined状态
  useEffect(() => {
    setIsJoined(isJoined);
  }, [isJoined, setIsJoined]);

  const pollSession = useCallback(async () => {
    console.log("pollSession", { sessionId, currentUser }); // 调试日志
    if (!sessionId || !currentUser) return;
    try {
      const result = await getSessionData(sessionId);
      console.log("getSessionData result", result); // 调试日志
      if (result.success && result.session) {
        setSession(result.session);
        setIsConnected(true);
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  }, [sessionId, currentUser]);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !currentUser) return;
    try {
      await heartbeat(sessionId, currentUser);
    } catch {}
  }, [sessionId, currentUser]);

  useEffect(() => {
    if (!isJoined || isRestoring) return;
    pollSession();
    const pollInterval = setInterval(pollSession, 2000);
    const heartbeatInterval = setInterval(sendHeartbeat, 5000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [isJoined, isRestoring, pollSession, sendHeartbeat]);

  return {
    session,
    isJoined,
    isConnected,
    isLoading,
    setSession,
    setIsJoined,
    setIsConnected,
    setIsLoading,
    pollSession,
    sendHeartbeat,
  };
}
