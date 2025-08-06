import { useState } from "react";

export interface UIState {
  copied: boolean;
  showSessionErrorModal: boolean;
}

export interface UIStateHandlers {
  setShowSessionErrorModal: (show: boolean) => void;
  copyShareLink: (sessionId: string) => Promise<void>;
  updateURL: (sessionId: string, isJoined: boolean) => void;
  clearURL: () => void;
}

export function useUIState(): UIState & UIStateHandlers {
  const [copied, setCopied] = useState(false);
  const [showSessionErrorModal, setShowSessionErrorModal] = useState(false);

  const copyShareLink = async (sessionId: string) => {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("session", sessionId);
    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const updateURL = (sessionId: string, isJoined: boolean) => {
    if (sessionId && isJoined) {
      const url = new URL(window.location.href);
      url.searchParams.set("session", sessionId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const clearURL = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    window.history.replaceState({}, "", url.toString());
  };

  return {
    copied,
    showSessionErrorModal,
    setShowSessionErrorModal,
    copyShareLink,
    updateURL,
    clearURL,
  };
} 