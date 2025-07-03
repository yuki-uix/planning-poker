"use client";

import { ControlButtons } from "@/components/control-buttons";
import { LoginForm } from "@/components/login-form";
import { ResultsDisplay } from "@/components/results-display";
import { SessionHeader } from "@/components/session-header";
import { SessionErrorModal } from "@/components/session-error-modal";
import { TemplateSettings } from "@/components/template-settings";
import { UserStatus } from "@/components/user-status";
import { VotingCards } from "@/components/voting-cards";
import { calculateStats, checkAllUsersVoted } from "@/lib/estimation-utils";
import { UserRole } from "@/lib/session-store";
import {
  saveUserData,
  getUserData,
  clearAllData,
  updateUserVote,
  updateSessionState,
  migrateFromOldStorage,
} from "@/lib/persistence";
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
  transferHost,
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
  const [isRestoring, setIsRestoring] = useState(true);
  const [showSessionErrorModal, setShowSessionErrorModal] = useState(false);

  // 获取当前用户信息
  const currentUserData = session?.users.find((u) => u.id === currentUser);
  const isHost = session?.hostId === currentUser;
  const canVote =
    currentUserData?.role === "attendance" || currentUserData?.role === "host";

  // 改进的页面加载时恢复用户状态
  useEffect(() => {
    const restoreUserState = async () => {
      setIsRestoring(true);

      try {
        // 首先尝试迁移旧版本数据
        await migrateFromOldStorage();

        // 尝试从持久化存储恢复用户信息
        const storedUserData = await getUserData();

        if (storedUserData) {
          // 如果有有效的存储用户信息，尝试恢复会话
          setCurrentUser(storedUserData.userId);
          setUserName(storedUserData.userName);
          setSessionId(storedUserData.sessionId);
          setSelectedRole(storedUserData.role);

          // 恢复用户投票状态
          if (storedUserData.lastVote !== undefined) {
            setSelectedVote(storedUserData.lastVote);
          }

          // 尝试获取会话数据
          try {
            const result = await getSessionData(storedUserData.sessionId);
            if (result.success && result.session) {
              // 检查用户是否还在会话中
              const userExists = result.session.users.find(
                (u) => u.id === storedUserData.userId
              );

              if (userExists) {
                setSession(result.session);
                setIsJoined(true);
                setIsConnected(true);

                // 如果服务器端没有投票记录但本地有，尝试恢复投票
                if (!userExists.hasVoted && storedUserData.lastVote) {
                  try {
                    const voteResult = await castVote(
                      storedUserData.sessionId,
                      storedUserData.userId,
                      storedUserData.lastVote
                    );
                    if (voteResult.success && voteResult.session) {
                      setSession(voteResult.session);
                    }
                  } catch (error) {
                    console.log(
                      "Failed to restore vote, clearing local vote",
                      error
                    );
                    setSelectedVote(null);
                    await updateUserVote(null);
                  }
                }

                return; // 成功恢复，不需要进一步处理
              }
            }
          } catch (error) {
            console.log(
              "Failed to restore session, will show login form",
              error
            );
          }

          // 如果恢复失败，清除存储的信息
          clearAllData();
        }

        // 如果没有存储信息或恢复失败，从URL参数读取session ID
        const urlParams = new URLSearchParams(window.location.search);
        const sessionFromUrl = urlParams.get("session");
        
        // 检查URL中的sessionId是否与存储的不同
        if (sessionFromUrl && (!storedUserData || storedUserData.sessionId !== sessionFromUrl)) {
          // 如果URL中有不同的sessionId，说明是受邀加入新会话
          setSessionId(sessionFromUrl);
          setSelectedRole("attendance");
          // 清除之前的用户信息，因为要加入新会话
          if (storedUserData) {
            clearAllData();
          }
        } else if (sessionFromUrl && storedUserData && storedUserData.sessionId === sessionFromUrl) {
          // URL中的sessionId与存储的相同，继续使用存储的信息
          setSessionId(sessionFromUrl);
          setSelectedRole(storedUserData.role);
        } else if (!sessionFromUrl) {
          // 如果没有sessionId参数，说明是初始用户，默认为host
          setSelectedRole("host");
        }
      } catch (error) {
        console.error("Error during state restoration:", error);
        clearAllData();
      } finally {
        setIsRestoring(false);
      }
    };

    restoreUserState();
  }, []); // 只在组件挂载时执行一次

  // 轮询会话数据
  const pollSession = useCallback(async () => {
    if (!sessionId || !currentUser) return;

    try {
      const result = await getSessionData(sessionId);
      if (result.success && result.session) {
        setSession(result.session);
        setIsConnected(true);

        // 更新持久化存储的会话状态
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });

        // 更新持久化存储的用户投票信息
        const currentUserInSession = result.session.users.find(
          (u) => u.id === currentUser
        );
        if (currentUserInSession) {
          setSelectedVote(currentUserInSession.vote);
          await updateUserVote(currentUserInSession.vote);
        }
      } else {
        // session不存在，可能是被删除了
        setIsConnected(false);
        // 如果session不存在，自动logout
        if (isJoined) {
          console.log("Session not found, auto logout");
          performLogout();
        }
      }
    } catch (error) {
      console.error("Failed to poll session:", error);
      setIsConnected(false);
    }
  }, [sessionId, currentUser, isJoined]);

  // 发送心跳
  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !currentUser) return;

    try {
      await heartbeat(sessionId, currentUser);
    } catch (error) {
      console.error("Failed to send heartbeat:", error);
    }
  }, [sessionId, currentUser]);

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

  // Set up polling and heartbeat
  useEffect(() => {
    if (!isJoined || isRestoring) return;

    // Initial poll
    pollSession();

    // Set up polling interval (every 2 seconds)
    const pollInterval = setInterval(pollSession, 2000);

    // Set up heartbeat interval (every 5 seconds)
    const heartbeatInterval = setInterval(sendHeartbeat, 5000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [isJoined, isRestoring, pollSession, sendHeartbeat]);

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

        // 保存用户信息到持久化存储，包括初始会话状态
        await saveUserData({
          userId,
          userName,
          sessionId: result.sessionId,
          role: "host",
          lastVote: null,
          lastSessionState: {
            revealed: result.session.revealed,
            template: result.session.template,
          },
        });
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

        // 保存用户信息到持久化存储，包括会话状态
        await saveUserData({
          userId,
          userName,
          sessionId,
          role: selectedRole,
          lastVote: null,
          lastSessionState: {
            revealed: result.session.revealed,
            template: result.session.template,
          },
        });
      } else {
        // session 不存在，显示错误 modal
        setShowSessionErrorModal(true);
      }
    } catch {
      console.error("Failed to join session");
      setIsConnected(false);
      // 发生错误时也显示 modal
      setShowSessionErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCastVote = async (vote: string) => {
    if (!session || !currentUser || !canVote) return;

    setSelectedVote(vote);
    // 立即更新持久化存储的投票信息
    await updateUserVote(vote);

    try {
      const result = await castVote(sessionId, currentUser, vote);
      if (result.success && result.session) {
        setSession(result.session);
      }
    } catch {
      console.error("Failed to cast vote");
      // 如果投票失败，恢复之前的投票状态
      const currentUserInSession = session.users.find(
        (u) => u.id === currentUser
      );
      setSelectedVote(currentUserInSession?.vote || null);
      await updateUserVote(currentUserInSession?.vote || null);
    }
  };

  const handleRevealVotes = async () => {
    if (!session || !isHost) return;

    try {
      const result = await revealVotes(sessionId, currentUser);
      if (result.success && result.session) {
        setSession(result.session);
        // 更新持久化存储的会话状态
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
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
        // 更新持久化存储的投票信息
        await updateUserVote(null);
        // 更新持久化存储的会话状态
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
        // 立即轮询以确保状态同步
        await pollSession();
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
        setSelectedVote(null);
        // 更新持久化存储的投票信息
        await updateUserVote(null);
        // 更新持久化存储的会话状态
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
        // 立即轮询以确保状态同步
        await pollSession();
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
        setSelectedVote(null);
        // 更新持久化存储的投票信息
        await updateUserVote(null);
        // 更新持久化存储的会话状态
        await updateSessionState(sessionId, {
          revealed: result.session.revealed,
          template: result.session.template,
        });
        // 立即轮询以确保状态同步
        await pollSession();
      }
    } catch {
      console.error("Failed to update custom cards");
    }
  };

  const performLogout = () => {
    // 清除持久化存储的用户信息
    clearAllData();

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

  const handleLogout = async () => {
    // 如果是host，先尝试转移权限
    if (isHost && sessionId && currentUser) {
      try {
        const result = await transferHost(sessionId, currentUser);
        if (result.success && result.session) {
          // 权限转移成功，其他用户会通过轮询自动更新状态
          console.log("Host role transferred successfully");
        } else if (!result.session) {
          // session被删除，其他用户会在下次轮询时发现并自动logout
          console.log("Session deleted, all users will be logged out");
        }
      } catch (error) {
        console.error("Failed to transfer host role:", error);
      }
    }

    performLogout();
  };

  const handleBackToHost = () => {
    // 关闭 modal
    setShowSessionErrorModal(false);
    // 清除持久化存储的用户信息
    clearAllData();
    // 清除当前 sessionId，回到主持人创建页面
    setSessionId("");
    setSelectedRole("host");
    // 清除用户信息
    setCurrentUser("");
    setUserName("");
    setSelectedVote(null);
    setIsJoined(false);
    setIsConnected(true);
    // 清除 URL 参数
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    window.history.replaceState({}, "", url.toString());
  };

  // 计算统计数据
  const stats = session ? calculateStats(session) : null;
  const allUsersVoted = session ? checkAllUsersVoted(session) : false;

  // 如果正在恢复状态，显示加载状态
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">loading...</p>
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <>
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
        <SessionErrorModal
          isOpen={showSessionErrorModal}
          onClose={() => setShowSessionErrorModal(false)}
          onBackToHost={handleBackToHost}
        />
      </>
    );
  }

  if (!session) return null;

  return (
    <>
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
          <div className="flex flex-row gap-4">
            <div className="flex-1">
              <VotingCards
                session={session}
                currentUser={currentUser}
                selectedVote={selectedVote}
                canVote={canVote}
                onCastVote={handleCastVote}
              />
            </div>
            <div className="w-1/2">
              <UserStatus session={session} currentUser={currentUser} />
            </div>
          </div>

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

      <SessionErrorModal
        isOpen={showSessionErrorModal}
        onClose={() => setShowSessionErrorModal(false)}
        onBackToHost={handleBackToHost}
      />
    </>
  );
}
