"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, User, EyeOff } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { Session } from "@/types/estimation";

interface UserStatusProps {
  session: Session;
  currentUser: string;
}

export function UserStatus({ session, currentUser }: UserStatusProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.voting.statusTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {session.users.map((user) => (
            <div key={user.id} className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  user.id === currentUser ? "bg-blue-500" : "bg-green-500"
                }`}
              />
              <span className="text-sm font-medium">
                {user.name} {user.id === currentUser && `(${t.main.you})`}
              </span>
              <Badge variant="outline" className="text-xs">
                {user.role === "host" && <Crown className="w-3 h-3 mr-1" />}
                {user.role === "attendance" && (
                  <User className="w-3 h-3 mr-1" />
                )}
                {user.role === "guest" && <EyeOff className="w-3 h-3 mr-1" />}
                {t.main[user.role]}
              </Badge>
              {user.hasVoted &&
                (user.role === "attendance" || user.role === "host") && (
                  <Badge variant={session.revealed ? "default" : "secondary"}>
                    {session.revealed ? user.vote : "✓"}
                  </Badge>
                )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
