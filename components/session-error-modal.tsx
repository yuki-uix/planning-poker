import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/use-language";

interface SessionErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToHost: () => void;
}

export function SessionErrorModal({
  isOpen,
  onClose,
  onBackToHost,
}: SessionErrorModalProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">
            {t.errors.sessionNotFound.title}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {t.errors.sessionNotFound.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-row space-x-3">
          <Button onClick={onBackToHost} className="w-full">
            {t.errors.sessionNotFound.backToHostButton}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            {t.errors.sessionNotFound.closeButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 