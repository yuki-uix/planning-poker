"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import {
  ESTIMATION_TEMPLATES,
  Session,
  TemplateType,
} from "@/types/estimation";
import { Settings } from "lucide-react";
import { useState } from "react";

interface TemplateSettingsProps {
  session: Session;
  isHost: boolean;
  onTemplateChange: (templateType: TemplateType) => void;
  onCustomCardsChange: (customCards: string) => void;
}

export function TemplateSettings({
  session,
  isHost,
  onTemplateChange,
  onCustomCardsChange,
}: TemplateSettingsProps) {
  const { t } = useLanguage();
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);

  if (!isHost) return null;

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t.templates.title}
            </CardTitle>
            <CardDescription>{t.templates.subtitle}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateSettings(!showTemplateSettings)}
          >
            {showTemplateSettings
              ? t.templates.hideSettings
              : t.templates.showSettings}
          </Button>
        </div>
      </CardHeader>
      {showTemplateSettings && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t.templates.selectTemplate}
            </label>
            <Select
              value={selectedTemplate}
              onValueChange={(value: TemplateType) => onTemplateChange(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTIMATION_TEMPLATES).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <div className="font-medium">
                        {
                          t.templateNames[
                            template.name as keyof typeof t.templateNames
                          ]
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {
                          t.templateDescriptions[
                            template.description as keyof typeof t.templateDescriptions
                          ]
                        }
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate === "custom" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.templates.customValues}
              </label>
              <Input
                placeholder={t.templates.customPlaceholder}
                value={customCards}
                onChange={(e) => onCustomCardsChange(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                {t.templates.currentCards}: {currentEstimationCards.join(", ")}
              </div>
            </div>
          )}

          {selectedTemplate !== "custom" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.templates.preview}
              </label>
              <div className="flex flex-wrap gap-2">
                {currentEstimationCards.map((card) => (
                  <Badge key={card} variant="outline" className="text-sm">
                    {card}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
