"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EyeOff } from "lucide-react";
import { useVotingCards } from "./useVotingCards";
import type { VotingCardsProps } from "./types";

export function VotingCards(props: VotingCardsProps) {
  const { t, currentUserData, currentEstimationCards } = useVotingCards(props);
  const { selectedVote, onCastVote, canVote, session } = props;

  // 如果是guest用户，显示投票卡片但不能点击
  if (currentUserData?.role === "guest") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-title">{t.voting.title}</CardTitle>
          <CardDescription>{t.voting.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
            {currentEstimationCards.map((card: string) => (
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
        <CardTitle className="text-title">{t.voting.title}</CardTitle>
        <CardDescription>{t.voting.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
          {currentEstimationCards.map((card: string) => (
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
