import { useLanguage } from "../../hooks/use-language";
import { useState } from "react";
import type { TemplateSettingsProps } from "./types";
import { ESTIMATION_TEMPLATES, TemplateType } from "../../types/estimation";

export function useTemplateSettings(props: TemplateSettingsProps) {
  const { session } = props;
  const { t } = useLanguage();
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const selectedTemplate =
    (session.template?.type as TemplateType) || "fibonacci";
  const customCards = session.template?.customCards || "☕️,1,2,3,5,8,13";

  // 获取当前估点卡片
  const getCurrentEstimationCards = () => {
    if (selectedTemplate === "custom") {
      return customCards
        .split(",")
        .map((card) => card.trim())
        .filter((card) => card.length > 0);
    }
    return [...ESTIMATION_TEMPLATES[selectedTemplate].cards];
  };

  const currentEstimationCards = getCurrentEstimationCards();

  return {
    t,
    showTemplateSettings,
    setShowTemplateSettings,
    selectedTemplate,
    customCards,
    currentEstimationCards,
    ...props,
  };
}
