"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Calculator } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import {
  Session,
  EstimationStats,
  ESTIMATION_TEMPLATES,
  TemplateType,
} from "@/types/estimation";

interface ResultsDisplayProps {
  session: Session;
  stats: EstimationStats;
}

export function ResultsDisplay({ session, stats }: ResultsDisplayProps) {
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
    return ESTIMATION_TEMPLATES[selectedTemplate].cards;
  };

  const currentEstimationCards = getCurrentEstimationCards();

  if (!session.revealed || !stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          {t.results.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Distribution */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            {t.results.distribution}
          </h3>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
            {currentEstimationCards.map((card: string) => {
              const count = stats.distribution[card] || 0;
              return (
                <div key={card} className="text-center">
                  <div className="text-2xl font-bold mb-1">{card}</div>
                  <div className="text-sm text-muted-foreground">
                    {count} {t.results.votes}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${
                          stats.totalVotes > 0
                            ? (count / stats.totalVotes) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Average */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calculator className="w-5 h-5" />
            <h3 className="text-lg font-semibold">{t.results.teamEstimate}</h3>
          </div>
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {stats.average}
          </div>
          <div className="text-sm text-muted-foreground">
            {stats.validVotes} {t.results.averageDescription}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
