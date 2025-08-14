import { useState, useEffect } from "react";
import { UserRole } from "../../../lib/session-store";
import {
  getUserData,
  clearAllData,
  migrateFromOldStorage,
} from "../../../lib/persistence";
import { 
  restoreUserAuthentication,
  clearAuthentication,
  verifyUserSession
} from "../../../app/actions";

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
  const [hasRestoredOnce, setHasRestoredOnce] = useState(false);

  const restoreUserState = async () => {
    if (hasRestoredOnce) {
      return;
    }
    setIsRestoring(true);
    try {
      // First try to restore from server-side authentication
      const authResult = await restoreUserAuthentication();
      if (authResult.success && authResult.userId && authResult.sessionId) {
        setCurrentUser(authResult.userId);
        setUserName(authResult.userName || "");
        setSessionId(authResult.sessionId);
        setSelectedRole(authResult.role || "attendance");
        setIsJoined(true);
        return;
      }

      // Fallback to client-side storage  
      try {
        await migrateFromOldStorage();
      } catch (migrationError) {
        console.error("Migration failed:", migrationError);
      }
      const storedUserData = await getUserData();
      if (storedUserData) {
        // Verify server-side session still exists
        try {
          const verification = await verifyUserSession(
            storedUserData.userId,
            storedUserData.sessionId
          );
          
          if (verification.success && 'role' in verification) {
            setCurrentUser(storedUserData.userId);
            setUserName(storedUserData.userName);
            setSessionId(storedUserData.sessionId);
            setSelectedRole(verification.role || storedUserData.role);
            
            if (storedUserData.lastVote !== undefined) {
              setSelectedVote(storedUserData.lastVote);
            }
            
            return;
          }
        } catch (error) {
          console.error("Failed to verify stored session:", error);
        }
        
        clearAllData();
        await clearAuthentication();
      }

      // Handle URL parameters for new sessions
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get("session");
      if (sessionFromUrl) {
        setSessionId(sessionFromUrl);
        setSelectedRole("attendance");
      } else {
        setSelectedRole("host");
      }
    } catch (error) {
      console.error("Failed to restore user state:", error);
      clearAllData();
      await clearAuthentication();
    } finally {
      setIsRestoring(false);
      setHasRestoredOnce(true);
    }
  };

  const clearUserState = async () => {
    clearAllData();
    await clearAuthentication();
    setCurrentUser("");
    setUserName("");
    setSessionId("");
    setSelectedRole("host");
    setSelectedVote(null);
    setIsJoined(false);
    setHasRestoredOnce(false); // Allow restoration to run again after clearing
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
