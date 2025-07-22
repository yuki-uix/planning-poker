export interface SessionErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToHost: () => void;
  errorMessage?: string;
}
