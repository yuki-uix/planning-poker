"use client";

import React from "react";
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
import { ESTIMATION_TEMPLATES, TemplateType } from "@/types/estimation";
import { Settings } from "lucide-react";
import type { TemplateSettingsProps } from "./types";
import { useTemplateSettings } from "./useTemplateSettings";

export function TemplateSettings(props: TemplateSettingsProps) {
  const {
    t,
    showTemplateSettings,
    setShowTemplateSettings,
    selectedTemplate,
    customCards,
    currentEstimationCards,
    isHost,
    onTemplateChange,
    onCustomCardsChange,
  } = useTemplateSettings(props);

  if (!isHost) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-title">
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
