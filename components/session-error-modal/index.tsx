import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SessionErrorModalProps } from "./types";
import { useSessionErrorModal } from "./useSessionErrorModal";

export function SessionErrorModal(props: SessionErrorModalProps) {
  const { t, isOpen, onClose, onBackToHost, errorMessage } = useSessionErrorModal(props);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">
            {t.errors.sessionNotFound.title}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {errorMessage || t.errors.sessionNotFound.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-row space-x-3">
          <Button onClick={onBackToHost} className="w-full">
            {t.errors.sessionNotFound.backToHostButton}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            {t.errors.sessionNotFound.closeButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
