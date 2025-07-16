"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeColorPicker } from "@/components/theme-color-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSessionHeader } from "./useSessionHeader";
import type { SessionHeaderProps } from "./types";
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

export function SessionHeader(props: SessionHeaderProps) {
  const { t, currentUserData, isConnected, copied, session } =
    useSessionHeader(props);
  const { sessionId, userName, onCopyShareLink, onLogout } = props;

  return (
    <Card>
      <CardHeader>
        {/* 第一行：会话标题和用户信息 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-2xl font-bold text-title">
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
          <div className="flex items-center gap-2">
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
        {/* 第二行：操作按钮和设置 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThemeColorPicker compact />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
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
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t.main.logout || "退出"}
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
