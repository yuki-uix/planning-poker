import { useState, useEffect } from "react";
import { UserRole } from "@/lib/session-store";
import {
  getUserData,
  clearAllData,
  updateUserVote,
  migrateFromOldStorage,
} from "@/lib/persistence";
import { getSessionData, castVote } from "@/app/actions";

export interface UserState {
  currentUser: string;
  userName: string;
  sessionId: string;
  selectedRole: UserRole;
  selectedVote: string | null;
  isRestoring: boolean;
  isJoined: boolean;
  setCurrentUser: (user: string) => void;
  setSessionId: (sessionId: string) => void;
}

export interface UserStateHandlers {
  setUserName: (name: string) => void;
  setSelectedRole: (role: UserRole) => void;
  setSelectedVote: (vote: string | null) => void;
  setIsJoined: (joined: boolean) => void;
  restoreUserState: () => Promise<void>;
  clearUserState: () => void;
}

export function useUserState(): UserState & UserStateHandlers {
  const [currentUser, setCurrentUser] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("attendance");
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isJoined, setIsJoined] = useState(false);

  const restoreUserState = async () => {
    setIsRestoring(true);
    try {
      await migrateFromOldStorage();
      const storedUserData = await getUserData();
      if (storedUserData) {
        setCurrentUser(storedUserData.userId);
        setUserName(storedUserData.userName);
        setSessionId(storedUserData.sessionId);
        setSelectedRole(storedUserData.role);
        if (storedUserData.lastVote !== undefined) {
          setSelectedVote(storedUserData.lastVote);
        }
        try {
          const result = await getSessionData(storedUserData.sessionId);
          if (result.success && result.session) {
            const userExists = result.session.users.find(
              (u) => u.id === storedUserData.userId
            );
            if (userExists) {
              if (!userExists.hasVoted && storedUserData.lastVote) {
                try {
                  const voteResult = await castVote(
                    storedUserData.sessionId,
                    storedUserData.userId,
                    storedUserData.lastVote
                  );
                  if (voteResult.success && voteResult.session) {
                    // Session will be updated by parent component
                  }
                } catch (error) {
                  console.error(error);
                  setSelectedVote(null);
                  await updateUserVote(null);
                }
              }
              return;
            }
          }
        } catch {}
        clearAllData();
      }
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get("session");
      if (
        sessionFromUrl &&
        (!storedUserData || storedUserData.sessionId !== sessionFromUrl)
      ) {
        setSessionId(sessionFromUrl);
        setSelectedRole("attendance");
        if (storedUserData) clearAllData();
      } else if (
        sessionFromUrl &&
        storedUserData &&
        storedUserData.sessionId === sessionFromUrl
      ) {
        setSessionId(sessionFromUrl);
        setSelectedRole(storedUserData.role);
      } else if (!sessionFromUrl) {
        setSelectedRole("host");
      }
    } catch {
      clearAllData();
    } finally {
      setIsRestoring(false);
    }
  };

  const clearUserState = () => {
    clearAllData();
    setCurrentUser("");
    setUserName("");
    setSessionId("");
    setSelectedRole("host");
    setSelectedVote(null);
  };

  useEffect(() => {
    restoreUserState();
  }, []);

  return {
    currentUser,
    userName,
    sessionId,
    selectedRole,
    selectedVote,
    isRestoring,
    isJoined,
    setUserName,
    setSelectedRole,
    setSelectedVote,
    setIsJoined,
    setCurrentUser, // 新增导出
    setSessionId, // 新增导出
    restoreUserState,
    clearUserState,
  };
}
