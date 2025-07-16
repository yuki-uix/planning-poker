"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLoginForm } from "./useLoginForm";
import type { LoginFormProps } from "./types";
import { UserRole } from "@/lib/session-store";
import { EyeOff, User } from "lucide-react";

export function LoginForm(props: LoginFormProps) {
  const {
    t,
    sessionId,
    userName,
    setUserName,
    selectedRole,
    setSelectedRole,
    isLoading,
    onCreateSession,
    onJoinSession,
  } = useLoginForm(props);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <LanguageSwitcher />
          </div>
          <CardTitle className="text-2xl font-bold text-title">
            {t.login.title}
          </CardTitle>
          <CardDescription>
            {sessionId ? t.login.joinSession : t.login.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="userName" className="text-sm font-medium">
              {t.login.nameLabel}
            </label>
            <Input
              id="userName"
              placeholder={t.login.namePlaceholder}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          {/* 如果有sessionId，说明是受邀加入，只显示attendance和guest选项 */}
          {sessionId ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t.login.roleLabel}
                </label>
                <RadioGroup
                  value={selectedRole}
                  onValueChange={(value: UserRole) => setSelectedRole(value)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="attendance" id="attendance" />
                    <Label htmlFor="attendance" className="flex-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="font-medium">
                            {t.login.roleAttendance}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.login.roleAttendanceDescription}
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="guest" id="guest" />
                    <Label htmlFor="guest" className="flex-1">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="font-medium">{t.login.roleGuest}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.login.roleGuestDescription}
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <Button
                onClick={onJoinSession}
                className="w-full"
                disabled={!userName.trim() || isLoading}
              >
                {isLoading ? t.login.joiningButton : t.login.joinButton}
              </Button>
            </>
          ) : (
            <>
              {/* 初始用户（host）不需要角色选择，直接显示创建按钮 */}
              <Button
                onClick={onCreateSession}
                className="w-full"
                disabled={!userName.trim() || isLoading}
              >
                {isLoading ? t.login.joiningButton : t.login.createButton}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
