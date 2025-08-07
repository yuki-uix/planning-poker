"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, EyeOff, User as UserIcon } from "lucide-react";
import type { UserStatusProps } from "./types";
import { useUserStatus } from "./useUserStatus";
import { User } from "../../types/estimation";

export function UserStatus(props: UserStatusProps) {
  const { t, votedUsers, notVotedUsers, guestUsers, session, currentUser } =
    useUserStatus(props);

  const renderUserCard = (user: User) => (
    <div
      key={user.id}
      className="space-y-2 w-auto bg-white p-3 rounded-lg border border-gray-200"
    >
      <div className="flex justify-center items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            user.id === currentUser ? "bg-blue-500" : "bg-green-500"
          }`}
        />
        <span className="text-sm font-medium">
          {user.name} {user.id === currentUser && `(${t.main.you})`}
        </span>
      </div>
      <div className="flex justify-center items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {user.role === "host" && <Crown className="w-3 h-3 mr-1" />}
          {user.role === "attendance" && <UserIcon className="w-3 h-3 mr-1" />}
          {user.role === "guest" && <EyeOff className="w-3 h-3 mr-1" />}
          {t.main[user.role as keyof typeof t.main]}
        </Badge>
        {user.hasVoted &&
          (user.role === "attendance" || user.role === "host") && (
            <Badge variant={session.revealed ? "default" : "secondary"}>
              {session.revealed ? user.vote : "✓"}
            </Badge>
          )}
      </div>
    </div>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-title">{t.voting.statusTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 已投票的用户 */}
          {votedUsers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-green-600 mb-2">
                ✓ {t.voting.votedUsers} ({votedUsers.length})
              </h3>
              <div className="flex flex-wrap gap-4">
                {votedUsers.map(renderUserCard)}
              </div>
            </div>
          )}

          {/* 未投票的用户 */}
          {notVotedUsers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-orange-600 mb-2">
                ⏳ {t.voting.notVotedUsers} ({notVotedUsers.length})
              </h3>
              <div className="flex flex-wrap gap-4">
                {notVotedUsers.map(renderUserCard)}
              </div>
            </div>
          )}

          {/* 访客用户 */}
          {guestUsers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                👁️ {t.voting.guestUsers} ({guestUsers.length})
              </h3>
              <div className="flex flex-wrap gap-4">
                {guestUsers.map(renderUserCard)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
