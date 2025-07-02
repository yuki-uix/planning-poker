"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EyeOff } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import {
  Session,
  ESTIMATION_TEMPLATES,
  TemplateType,
} from "@/types/estimation";

interface VotingCardsProps {
  session: Session;
  currentUser: string;
  selectedVote: string | null;
  canVote: boolean;
  onCastVote: (vote: string) => void;
}

export function VotingCards({
  session,
  currentUser,
  selectedVote,
  canVote,
  onCastVote,
}: VotingCardsProps) {
  const { t } = useLanguage();
  const currentUserData = session.users.find((u) => u.id === currentUser);

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

  // 如果是guest用户，显示投票卡片但不能点击
  if (currentUserData?.role === "guest") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.voting.title}</CardTitle>
          <CardDescription>{t.voting.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
            {currentEstimationCards.map((card) => (
              <Button
                key={card}
                variant="outline"
                className="h-20 text-lg font-bold opacity-60 cursor-not-allowed"
                disabled={true}
              >
                {card}
              </Button>
            ))}
          </div>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <EyeOff className="w-4 h-4 inline mr-1" />
            {t.voting.cannotVote}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 如果不能投票且不是guest，不显示任何内容
  if (!canVote) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.voting.title}</CardTitle>
        <CardDescription>{t.voting.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
          {currentEstimationCards.map((card) => (
            <Button
              key={card}
              variant={selectedVote === card ? "default" : "outline"}
              className="h-20 text-lg font-bold"
              onClick={() => onCastVote(card)}
              disabled={session.revealed}
            >
              {card}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
