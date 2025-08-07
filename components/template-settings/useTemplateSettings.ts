import { useLanguage } from "../../hooks/use-language";
import { useState, useEffect } from "react";
import type { TemplateSettingsProps } from "./types";
import { ESTIMATION_TEMPLATES, TemplateType } from "../../types/estimation";

export function useTemplateSettings(props: TemplateSettingsProps) {
  const { session } = props;
  const { t } = useLanguage();
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const selectedTemplate =
    (session.template?.type as TemplateType) || "fibonacci";
  const customCards = session.template?.customCards || "☕️,1,2,3,5,8,13";
  
  const [customCardsInput, setCustomCardsInput] = useState(customCards);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setCustomCardsInput(customCards);
  }, [customCards]);

  const validateCustomCards = (input: string): { isValid: boolean; error: string } => {
    if (!input.trim()) {
      return { isValid: false, error: t.templates.validation.empty };
    }

    const cards = input.split(",").map(card => card.trim()).filter(card => card.length > 0);
    
    if (cards.length === 0) {
      return { isValid: false, error: t.templates.validation.empty };
    }

    if (cards.length < 2) {
      return { isValid: false, error: t.templates.validation.minCards };
    }

    for (const card of cards) {
      if (card !== "☕️" && card !== "?" && isNaN(Number(card))) {
        return { isValid: false, error: t.templates.validation.invalidFormat };
      }
    }

    return { isValid: true, error: "" };
  };

  const handleConfirmCustomCards = () => {
    const validation = validateCustomCards(customCardsInput);
    
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    setValidationError("");
    props.onCustomCardsChange(customCardsInput);
  };

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
    customCardsInput,
    setCustomCardsInput,
    validationError,
    handleConfirmCustomCards,
    currentEstimationCards,
    ...props,
  };
}
