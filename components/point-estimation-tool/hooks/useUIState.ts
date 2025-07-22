import { useState } from "react";

export interface UIState {
  copied: boolean;
  showSessionErrorModal: boolean;
  errorMessage: string | null;
}

export interface UIStateHandlers {
  setShowSessionErrorModal: (show: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  copyShareLink: (sessionId: string) => Promise<void>;
  updateURL: (sessionId: string, isJoined: boolean) => void;
  clearURL: () => void;
}

export function useUIState(): UIState & UIStateHandlers {
  const [copied, setCopied] = useState(false);
  const [showSessionErrorModal, setShowSessionErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    errorMessage,
    setErrorMessage,
    copyShareLink,
    updateURL,
    clearURL,
  };
} 