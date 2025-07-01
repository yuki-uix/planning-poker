"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Eye,
  BarChart3,
  Calculator,
  Wifi,
  WifiOff,
  Settings,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import {
  joinSession,
  getSessionData,
  castVote,
  revealVotes,
  resetVotes,
  heartbeat,
} from "./actions";
import { useLanguage } from "@/hooks/use-language";
import { LanguageSwitcher } from "@/components/language-switcher";

interface User {
  id: string;
  name: string;
  vote: string | null;
  hasVoted: boolean;
  lastSeen: number;
}

interface Session {
  id: string;
  users: User[];
  revealed: boolean;
  votes: Record<string, string>;
  createdAt: number;
}

// 估点模板定义
const ESTIMATION_TEMPLATES = {
  fibonacci: {
    name: "fibonacci",
    description: "fibonacci",
    cards: ["☕️", "0.5", "1", "2", "3", "5", "8", "13", "21"],
  },
  natural: {
    name: "natural",
    description: "natural",
    cards: ["☕️", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  },
  custom: {
    name: "custom",
    description: "custom",
    cards: [],
  },
};

export default function PointEstimationTool() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [session, setSession] = useState<Session | null>(null);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // 估点模板相关状态
  const [selectedTemplate, setSelectedTemplate] =
    useState<keyof typeof ESTIMATION_TEMPLATES>("fibonacci");
  const [customCards, setCustomCards] = useState<string>("☕️,1,2,3,5,8,13");
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);

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

  // 从URL参数读取session ID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = urlParams.get('session');
    if (sessionFromUrl && !sessionId) {
      setSessionId(sessionFromUrl);
    }
  }, [sessionId]);

  // 更新URL以包含session ID
  useEffect(() => {
    if (sessionId && isJoined) {
      const url = new URL(window.location.href);
      url.searchParams.set('session', sessionId);
      window.history.replaceState({}, '', url.toString());
    }
  }, [sessionId, isJoined]);

  // 复制分享链接
  const copyShareLink = async () => {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('session', sessionId);
    
    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // Poll for session updates
  const pollSession = useCallback(async () => {
    if (!isJoined || !sessionId) return;

    try {
      const result = await getSessionData(sessionId);
      if (result.success && result.session) {
        setSession(result.session);
        setIsConnected(true);

        // Update selected vote based on current user's vote
        const currentUserData = result.session.users.find(
          (u) => u.id === currentUser
        );
        if (currentUserData) {
          setSelectedVote(currentUserData.vote);
        }
      }
    } catch (error) {
      setIsConnected(false);
    }
  }, [isJoined, sessionId, currentUser]);

  // Send heartbeat to keep user active
  const sendHeartbeat = useCallback(async () => {
    if (!isJoined || !sessionId || !currentUser) return;

    try {
      await heartbeat(sessionId, currentUser);
    } catch (error) {
      console.error("Heartbeat failed:", error);
    }
  }, [isJoined, sessionId, currentUser]);

  // Set up polling and heartbeat
  useEffect(() => {
    if (!isJoined) return;

    // Initial poll
    pollSession();

    // Set up polling interval (every 2 seconds)
    const pollInterval = setInterval(pollSession, 2000);

    // Set up heartbeat interval (every 10 seconds)
    const heartbeatInterval = setInterval(sendHeartbeat, 10000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [isJoined, pollSession, sendHeartbeat]);

  const handleJoinSession = async () => {
    if (!userName.trim() || !sessionId.trim()) return;

    setIsLoading(true);
    const userId = `${userName}-${Date.now()}`;
    setCurrentUser(userId);

    try {
      const result = await joinSession(sessionId, userId, userName);
      if (result.success && result.session) {
        setSession(result.session);
        setIsJoined(true);
        setIsConnected(true);
      }
    } catch (error) {
      console.error("Failed to join session:", error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCastVote = async (vote: string) => {
    if (!session || !currentUser) return;

    setSelectedVote(vote);

    try {
      const result = await castVote(sessionId, currentUser, vote);
      if (result.success && result.session) {
        setSession(result.session);
      }
    } catch (error) {
      console.error("Failed to cast vote:", error);
    }
  };

  const handleRevealVotes = async () => {
    if (!session) return;

    try {
      const result = await revealVotes(sessionId);
      if (result.success && result.session) {
        setSession(result.session);
      }
    } catch (error) {
      console.error("Failed to reveal votes:", error);
    }
  };

  const handleResetVotes = async () => {
    if (!session) return;

    try {
      const result = await resetVotes(sessionId);
      if (result.success && result.session) {
        setSession(result.session);
        setSelectedVote(null);
      }
    } catch (error) {
      console.error("Failed to reset votes:", error);
    }
  };

  const calculateStats = () => {
    if (!session || !session.revealed) return null;

    const votes = Object.values(session.votes);
    const numericVotes = votes
      .filter((vote) => vote !== "☕️")
      .map((vote) => Number.parseFloat(vote))
      .filter((vote) => !isNaN(vote));

    const distribution = currentEstimationCards.reduce(
      (acc: Record<string, number>, card: string) => {
        const count = votes.filter((vote: string) => vote === card).length;
        if (count > 0) {
          acc[card] = count;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    const average =
      numericVotes.length > 0
        ? numericVotes.reduce((sum, vote) => sum + vote, 0) /
          numericVotes.length
        : 0;

    return {
      distribution,
      average: Math.round(average * 10) / 10,
      totalVotes: votes.length,
      validVotes: numericVotes.length,
    };
  };

  const allUsersVoted = session?.users.every((user) => user.hasVoted) ?? false;
  const stats = calculateStats();

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-between mb-4">
              <div></div>
              <LanguageSwitcher />
            </div>
            <CardTitle className="text-2xl font-bold">
              {t.login.title}
            </CardTitle>
            <CardDescription>{t.login.subtitle}</CardDescription>
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
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sessionId" className="text-sm font-medium">
                {t.login.sessionIdLabel}
              </label>
              <Input
                id="sessionId"
                placeholder={t.login.sessionIdPlaceholder}
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleJoinSession}
              className="w-full"
              disabled={!userName.trim() || !sessionId.trim() || isLoading}
            >
              {isLoading ? t.login.joiningButton : t.login.joinButton}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">
                  {t.main.sessionTitle}: {sessionId}
                </CardTitle>
                <CardDescription>
                  {t.main.welcome}, {userName}!
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyShareLink}
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
                    {session?.users.length || 0} {t.main.users}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Template Settings */}
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
                  onValueChange={(value: keyof typeof ESTIMATION_TEMPLATES) =>
                    setSelectedTemplate(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESTIMATION_TEMPLATES).map(
                      ([key, template]) => (
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
                      )
                    )}
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
                    onChange={(e) => setCustomCards(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground">
                    {t.templates.currentCards}:{" "}
                    {currentEstimationCards.join(", ")}
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

        {/* Voting Cards */}
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
                  onClick={() => handleCastVote(card)}
                  disabled={session?.revealed}
                >
                  {card}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Users Status */}
        <Card>
          <CardHeader>
            <CardTitle>{t.voting.statusTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {session?.users.map((user: User) => (
                <div key={user.id} className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      user.id === currentUser ? "bg-blue-500" : "bg-green-500"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {user.name} {user.id === currentUser && `(${t.main.you})`}
                  </span>
                  {user.hasVoted && (
                    <Badge variant={session.revealed ? "default" : "secondary"}>
                      {session.revealed ? user.vote : "✓"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Control Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={handleRevealVotes}
            disabled={!allUsersVoted || session?.revealed}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            {t.voting.revealButton} (
            {session?.users.filter((u: User) => u.hasVoted).length || 0}/
            {session?.users.length || 0})
          </Button>
          <Button
            onClick={handleResetVotes}
            variant="outline"
            className="flex items-center gap-2 bg-transparent"
          >
            {t.voting.resetButton}
          </Button>
        </div>

        {/* Results */}
        {session?.revealed && stats && (
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
                  <h3 className="text-lg font-semibold">
                    {t.results.teamEstimate}
                  </h3>
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
        )}
      </div>
    </div>
  );
}
