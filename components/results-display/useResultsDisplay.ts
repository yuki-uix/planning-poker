import { useLanguage } from "@/hooks/use-language";
import type { ResultsDisplayProps } from "./types";
import { ESTIMATION_TEMPLATES, TemplateType } from "@/types/estimation";

export function useResultsDisplay(props: ResultsDisplayProps) {
  const { session, stats } = props;
  const { t } = useLanguage();
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
    currentEstimationCards,
    stats,
    session,
  };
}
