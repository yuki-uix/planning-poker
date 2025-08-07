import type { Session, TemplateType } from "../../types/estimation";

export interface TemplateSettingsProps {
  session: Session;
  isHost: boolean;
  onTemplateChange: (templateType: TemplateType) => void;
  onCustomCardsChange: (customCards: string) => void;
}
