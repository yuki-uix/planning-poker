"use client";
import { ControlButtons } from "@/components/control-buttons";
import { LoginForm } from "@/components/login-form";
import { ResultsDisplay } from "@/components/results-display";
import { SessionHeader } from "@/components/session-header";
import { SessionErrorModal } from "@/components/session-error-modal";
import { TemplateSettings } from "@/components/template-settings";
import { UserStatus } from "@/components/user-status";
import { VotingCards } from "@/components/voting-cards";
import { usePointEstimationTool } from "./usePointEstimationTool";
import { ConnectionDebugPanel } from "../connection-debug-panel";

export function PointEstimationTool() {
  const {
    currentUser,
    userName,
    sessionId,
    selectedRole,
    session,
    selectedVote,
    isJoined,
    isConnected,
    isLoading,
    copied,
    isRestoring,
    showSessionErrorModal,
    errorMessage,
    setUserName,
    setSelectedRole,
    setShowSessionErrorModal,
    handleCreateSession,
    handleJoinSession,
    handleCastVote,
    handleRevealVotes,
    handleResetVotes,
    handleTemplateChange,
    handleCustomCardsChange,
    handleLogout,
    handleBackToHost,
    copyShareLink,
    stats,
    allUsersVoted,
    isHost,
    canVote,
  } = usePointEstimationTool();

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
          errorMessage={errorMessage || undefined}
        />
        {/* 调试面板 - 仅在开发环境显示 */}
        {process.env.NODE_ENV === 'development' && (
          <ConnectionDebugPanel
            sessionId={sessionId}
            userId={currentUser}
            isConnected={isConnected}
            connectionType="http"
          />
        )}
      </>
    );
  }

  if (!session) return null;

  return (
    <>
      <div className="min-h-screen bg-background p-4">
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

          {session.revealed && stats && (
            <ResultsDisplay
              session={session}
              stats={stats}
            />
          )}
        </div>
      </div>

      <SessionErrorModal
        isOpen={showSessionErrorModal}
        onClose={() => setShowSessionErrorModal(false)}
        onBackToHost={handleBackToHost}
        errorMessage={errorMessage || undefined}
      />

      {/* 调试面板 - 仅在开发环境显示 */}
      {process.env.NODE_ENV === 'development' && (
        <ConnectionDebugPanel
          sessionId={sessionId}
          userId={currentUser}
          isConnected={isConnected}
          connectionType="http"
        />
      )}
    </>
  );
}
