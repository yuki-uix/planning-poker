"use client";

import { ControlButtons } from "@/components/control-buttons";
import { LoginForm } from "@/components/login-form";
import { ResultsDisplay } from "@/components/results-display";
import { SessionHeader } from "@/components/session-header";
import { TemplateSettings } from "@/components/template-settings";
import { UserStatus } from "@/components/user-status";
import { VotingCards } from "@/components/voting-cards";
import { calculateStats, checkAllUsersVoted } from "@/lib/estimation-utils";
import { UserRole } from "@/lib/session-store";
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

  // 从URL参数读取session ID
  useEffect(() => {
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
  }, [sessionId]);

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
