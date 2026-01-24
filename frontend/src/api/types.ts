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

export type ChallengeCategory = 'coding' | 'screentime';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';

export interface Challenge {
  id: number;
  creator: UserPublic;
  opponent: UserPublic | null;
  category: ChallengeCategory;
  stake_cents: number;
  prize_pool_cents: number;
  goal_type: string;
  goal_value: number;
  goal_period: string;
  status: ChallengeStatus;
  creator_progress: number;
  opponent_progress: number;
  winner_id: number | null;
  created_at: string;
  accepted_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
}

export interface ChallengeCreate {
  category: ChallengeCategory;
  stake_cents: number;
  opponent_username?: string;
  goal_type: string;
  goal_value: number;
  goal_period?: string;
}

export interface ChallengeList {
  challenges: Challenge[];
}

export interface UserSearchResult {
  users: UserPublic[];
}
