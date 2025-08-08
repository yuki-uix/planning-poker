"use client";
import React from "react";
import { ControlButtons } from "../control-buttons";
import { FirstTimeModal } from "../first-time-modal";
import { FireworksCelebration } from "../fireworks-celebration";
import { GuidedTour } from "../guided-tour";
import { LoginForm } from "../login-form";
import { ResultsDisplay } from "../results-display";
import { SessionHeader } from "../session-header";
import { SessionErrorModal } from "../session-error-modal";
import { TemplateSettings } from "../template-settings";
import { UserStatus } from "../user-status";
import { VotingCards } from "../voting-cards";
import { usePointEstimationTool } from "./usePointEstimationTool";
import { useUserGuidance } from "../../hooks/use-user-guidance";

export function PointEstimationTool() {
  const guidance = useUserGuidance();
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
        />
        {!sessionId && (
          <FirstTimeModal
            isOpen={guidance.showFirstTimeModal}
            onStartGuidance={guidance.startGuidance}
            onSkipGuidance={guidance.skipGuidance}
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

          {stats && <ResultsDisplay session={session} stats={stats} />}
        </div>
      </div>

      <SessionErrorModal
        isOpen={showSessionErrorModal}
        onClose={() => setShowSessionErrorModal(false)}
        onBackToHost={handleBackToHost}
      />

      {isHost && (
        <>
          <GuidedTour
            isActive={guidance.isGuidanceActive}
            currentStep={guidance.currentStep}
            steps={guidance.guidanceSteps}
            onNext={guidance.nextStep}
            onPrevious={guidance.previousStep}
            onSkip={guidance.skipGuidance}
            onComplete={guidance.completeGuidance}
          />
          <FireworksCelebration
            isActive={guidance.showFireworks}
            onComplete={guidance.finishFireworks}
          />
        </>
      )}
    </>
  );
}

export default PointEstimationTool;
