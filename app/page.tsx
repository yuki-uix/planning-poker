"use client";

import { ControlButtons } from "@/components/control-buttons";
import { LoginForm } from "@/components/login-form";
import { ResultsDisplay } from "@/components/results-display";
import { SessionHeader } from "@/components/session-header";
import { TemplateSettings } from "@/components/template-settings";
import { UserStatus } from "@/components/user-status";
import { VotingCards } from "@/components/voting-cards";
import { calculateStats, checkAllUsersVoted } from "@/lib/estimation-utils";
import {
  UserRole,
  saveUserInfoToStorage,
  getUserInfoFromStorage,
  clearUserInfoFromStorage,
} from "@/lib/session-store";
import { Session, TemplateType } from "@/types/estimation";
import { useCallback, useEffect, useState } from "react";
import {
  castVote,
  createSessionWithAutoId,
  getSessionData,
  heartbeat,
  joinSessionAsRole,
  resetVotes,
  revealVotes,
  updateTemplate,
} from "./actions";

export default function PointEstimationTool() {
  const [currentUser, setCurrentUser] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("attendance");
  const [session, setSession] = useState<Session | null>(null);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // 获取当前用户信息
  const currentUserData = session?.users.find((u) => u.id === currentUser);
  const isHost = session?.hostId === currentUser;
  const canVote =
    currentUserData?.role === "attendance" || currentUserData?.role === "host";

  // 页面加载时恢复用户状态
  useEffect(() => {
    const restoreUserState = async () => {
      // 首先尝试从本地存储恢复用户信息
      const storedUserInfo = getUserInfoFromStorage();

      if (storedUserInfo) {
        // 如果有存储的用户信息，尝试恢复会话
        setCurrentUser(storedUserInfo.userId);
        setUserName(storedUserInfo.userName);
        setSessionId(storedUserInfo.sessionId);
        setSelectedRole(storedUserInfo.role);

        // 尝试获取会话数据
        try {
          const result = await getSessionData(storedUserInfo.sessionId);
          if (result.success && result.session) {
            // 检查用户是否还在会话中
            const userExists = result.session.users.find(
              (u) => u.id === storedUserInfo.userId
            );
            if (userExists) {
              setSession(result.session);
              setIsJoined(true);
              setIsConnected(true);
              setSelectedVote(userExists.vote);
              return; // 成功恢复，不需要进一步处理
            }
          }
        } catch (error) {
          console.log("Failed to restore session, will show login form", error);
        }

        // 如果恢复失败，清除存储的信息
        clearUserInfoFromStorage();
      }

      // 如果没有存储信息或恢复失败，从URL参数读取session ID
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get("session");
      if (sessionFromUrl && !sessionId) {
        setSessionId(sessionFromUrl);
        // 如果从URL获取到sessionId，说明是受邀加入，只能选择attendance或guest
        setSelectedRole("attendance");
      } else if (!sessionFromUrl) {
        // 如果没有sessionId参数，说明是初始用户，默认为host
        setSelectedRole("host");
      }
    };

    restoreUserState();
  }, [sessionId, currentUser, userName]);

  // 更新URL以包含session ID
  useEffect(() => {
    if (sessionId && isJoined) {
      const url = new URL(window.location.href);
      url.searchParams.set("session", sessionId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [sessionId, isJoined]);

  // 复制分享链接
  const copyShareLink = async () => {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("session", sessionId);

    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy link");
    }
  };

  // Poll for session updates
  const pollSession = useCallback(async () => {
    if (!isJoined || !sessionId) return;

    try {
      const result = await getSessionData(sessionId);
      if (result.success && result.session) {
        setSession(result.session);
        setIsConnected(true);

        // Update selected vote based on current user's vote
        const currentUserData = result.session.users.find(
          (u) => u.id === currentUser
        );
        if (currentUserData) {
          setSelectedVote(currentUserData.vote);
        }
      }
    } catch {
      setIsConnected(false);
    }
  }, [isJoined, sessionId, currentUser]);

  // Send heartbeat to keep user active
  const sendHeartbeat = useCallback(async () => {
    if (!isJoined || !sessionId || !currentUser) return;

    try {
      await heartbeat(sessionId, currentUser);
    } catch {
      console.error("Heartbeat failed");
    }
  }, [isJoined, sessionId, currentUser]);

  // Set up polling and heartbeat
  useEffect(() => {
    if (!isJoined) return;

    // Initial poll
    pollSession();

    // Set up polling interval (every 2 seconds)
    const pollInterval = setInterval(pollSession, 2000);

    // Set up heartbeat interval (every 10 seconds)
    const heartbeatInterval = setInterval(sendHeartbeat, 10000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [isJoined, pollSession, sendHeartbeat]);

  const handleCreateSession = async () => {
    if (!userName.trim()) return;

    setIsLoading(true);
    const userId = `${userName}-${Date.now()}`;
    setCurrentUser(userId);

    try {
      const result = await createSessionWithAutoId(userId, userName);
      if (result.success && result.session && result.sessionId) {
        setSession(result.session);
        setSessionId(result.sessionId);
        setIsJoined(true);
        setIsConnected(true);

        // 保存用户信息到本地存储
        saveUserInfoToStorage(userId, userName, result.sessionId, "host");
      }
    } catch {
      console.error("Failed to create session");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSession = async () => {
    if (!userName.trim() || !sessionId) return;

    setIsLoading(true);
    const userId = `${userName}-${Date.now()}`;
    setCurrentUser(userId);

    try {
      const result = await joinSessionAsRole(
        sessionId,
        userId,
        userName,
        selectedRole
      );
      if (result.success && result.session) {
        setSession(result.session);
        setIsJoined(true);
        setIsConnected(true);

        // 保存用户信息到本地存储
        saveUserInfoToStorage(userId, userName, sessionId, selectedRole);
      }
    } catch {
      console.error("Failed to join session");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCastVote = async (vote: string) => {
    if (!session || !currentUser || !canVote) return;

    setSelectedVote(vote);

    try {
      const result = await castVote(sessionId, currentUser, vote);
      if (result.success && result.session) {
        setSession(result.session);
      }
    } catch {
      console.error("Failed to cast vote");
    }
  };

  const handleRevealVotes = async () => {
    if (!session || !isHost) return;

    try {
      const result = await revealVotes(sessionId, currentUser);
      if (result.success && result.session) {
        setSession(result.session);
      }
    } catch {
      console.error("Failed to reveal votes");
    }
  };

  const handleResetVotes = async () => {
    if (!session || !isHost) return;

    try {
      const result = await resetVotes(sessionId, currentUser);
      if (result.success && result.session) {
        setSession(result.session);
        setSelectedVote(null);
      }
    } catch {
      console.error("Failed to reset votes");
    }
  };

  const handleTemplateChange = async (templateType: TemplateType) => {
    if (!session || !isHost) return;

    try {
      const result = await updateTemplate(sessionId, currentUser, templateType);
      if (result.success && result.session) {
        setSession(result.session);
      }
    } catch {
      console.error("Failed to update template");
    }
  };

  const handleCustomCardsChange = async (newCustomCards: string) => {
    if (!session || !isHost) return;

    try {
      const result = await updateTemplate(
        sessionId,
        currentUser,
        session.template.type as TemplateType,
        newCustomCards
      );
      if (result.success && result.session) {
        setSession(result.session);
      }
    } catch {
      console.error("Failed to update custom cards");
    }
  };

  const handleLogout = () => {
    // 清除本地存储的用户信息
    clearUserInfoFromStorage();

    // 重置所有状态
    setCurrentUser("");
    setUserName("");
    setSessionId("");
    setSelectedRole("host");
    setSession(null);
    setSelectedVote(null);
    setIsJoined(false);
    setIsConnected(true);
    setIsLoading(false);
    setCopied(false);

    // 清除URL参数
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    window.history.replaceState({}, "", url.toString());
  };

  // 计算统计数据
  const stats = session ? calculateStats(session) : null;
  const allUsersVoted = session ? checkAllUsersVoted(session) : false;

  if (!isJoined) {
    return (
      <LoginForm
        sessionId={sessionId}
        userName={userName}
        setUserName={setUserName}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        isLoading={isLoading}
        onCreateSession={handleCreateSession}
        onJoinSession={handleJoinSession}
      />
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <SessionHeader
          session={session}
          sessionId={sessionId}
          userName={userName}
          currentUser={currentUser}
          isConnected={isConnected}
          copied={copied}
          onCopyShareLink={copyShareLink}
          onLogout={handleLogout}
        />

        <TemplateSettings
          session={session}
          isHost={isHost}
          onTemplateChange={handleTemplateChange}
          onCustomCardsChange={handleCustomCardsChange}
        />

        <VotingCards
          session={session}
          currentUser={currentUser}
          selectedVote={selectedVote}
          canVote={canVote}
          onCastVote={handleCastVote}
        />

        <UserStatus session={session} currentUser={currentUser} />

        <ControlButtons
          session={session}
          isHost={isHost}
          allUsersVoted={allUsersVoted}
          onRevealVotes={handleRevealVotes}
          onResetVotes={handleResetVotes}
        />

        {stats && <ResultsDisplay session={session} stats={stats} />}
      </div>
    </div>
  );
}
