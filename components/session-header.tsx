"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/hooks/use-language";
import { Session } from "@/types/estimation";
import {
  Check,
  Crown,
  EyeOff,
  LogOut,
  Share2,
  User,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

interface SessionHeaderProps {
  session: Session;
  sessionId: string;
  userName: string;
  currentUser: string;
  isConnected: boolean;
  copied: boolean;
  onCopyShareLink: () => void;
  onLogout: () => void;
}

export function SessionHeader({
  session,
  sessionId,
  userName,
  currentUser,
  isConnected,
  copied,
  onCopyShareLink,
  onLogout,
}: SessionHeaderProps) {
  const { t } = useLanguage();
  const currentUserData = session.users.find((u) => u.id === currentUser);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">
              {t.main.sessionTitle}: {sessionId}
            </CardTitle>
            <CardDescription>
              {t.main.welcome}, {userName}!
              <Badge variant="outline" className="ml-2">
                {currentUserData?.role === "host" && (
                  <Crown className="w-3 h-3 mr-1" />
                )}
                {currentUserData?.role === "attendance" && (
                  <User className="w-3 h-3 mr-1" />
                )}
                {currentUserData?.role === "guest" && (
                  <EyeOff className="w-3 h-3 mr-1" />
                )}
                {t.main[currentUserData?.role || "attendance"]}
              </Badge>
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyShareLink}
              className="flex items-center gap-2"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              {copied ? t.main.copied : t.main.share}
            </Button>
            <LanguageSwitcher />
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t.main.logout || "退出"}
            </Button>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm text-muted-foreground">
                {isConnected ? t.main.connected : t.main.disconnected}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                {session.users.length || 0} {t.main.users}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
