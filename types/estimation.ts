import { UserRole } from "@/lib/session-store";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  vote: string | null;
  hasVoted: boolean;
  lastSeen: number;
  lastActive?: number;
}

export interface Session {
  id: string;
  users: User[];
  revealed: boolean;
  votes: Record<string, string>;
  createdAt: number;
  hostId: string;
  lastUpdated?: number;
  template: {
    type: string;
    customCards?: string;
  };
}

export interface EstimationStats {
  distribution: Record<string, number>;
  average: number;
  totalVotes: number;
  validVotes: number;
}

// 估点模板定义
export const ESTIMATION_TEMPLATES = {
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
} as const;

export type TemplateType = keyof typeof ESTIMATION_TEMPLATES;
