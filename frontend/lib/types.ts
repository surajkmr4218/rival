// User types
export interface User {
  id: number;
  email: string;
  username: string;
  balance_cents: number;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface UserPublic {
  id: number;
  username: string;
  email: string;
}

// Challenge types
export type ChallengeCategory = 'coding' | 'screentime';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';

export interface Challenge {
  id: number;
  creator: UserPublic;
  opponent: UserPublic | null;
  category: ChallengeCategory;
  stake_cents: number;
  prize_pool_cents: number;
  // AI Referee prompt
  challenge_prompt: string | null;
  duration_hours: number;
  // Legacy fields (backwards compatibility)
  goal_type: string | null;
  goal_value: number | null;
  goal_period: string | null;
  // Status & progress
  status: ChallengeStatus;
  creator_progress: number;
  opponent_progress: number;
  winner_id: number | null;
  // AI Referee verdict
  ai_verdict: string | null;
  ai_evaluated_at: string | null;
  // Timestamps
  created_at: string;
  accepted_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
}

export interface ChallengeCreate {
  category: ChallengeCategory;
  stake_cents: number;
  opponent_username?: string;
  challenge_prompt: string;
  duration_hours?: number;
}

export interface ChallengeList {
  challenges: Challenge[];
}

export interface UserSearchResult {
  users: UserPublic[];
}
