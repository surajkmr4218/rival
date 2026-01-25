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
export type ChallengeCategory = 'coding' | 'screentime' | 'studying';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';

// Notion activity tracking
export interface NotionPageEdited {
  id: string;
  title: string;
  last_edited: string;
  block_count: number;
}

export interface NotionActivity {
  pages_edited: NotionPageEdited[];
  total_blocks: number;
  page_count: number;
  content_summary: string;
}

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
  // Notion (for studying challenges)
  creator_notion_page_id: string | null;
  opponent_notion_page_id: string | null;
  creator_notion_activity: NotionActivity | null;
  opponent_notion_activity: NotionActivity | null;
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
  // For studying challenges: creator selects page upfront
  creator_notion_page_id?: string;
}

export interface ChallengeAccept {
  // For studying challenges: opponent selects page when accepting
  opponent_notion_page_id?: string;
}

export interface ChallengeList {
  challenges: Challenge[];
}

export interface UserSearchResult {
  users: UserPublic[];
}

// Notion types
export interface NotionPage {
  id: string;
  title: string;
  last_edited: string | null;
}

export interface NotionStatus {
  connected: boolean;
  workspace_name: string | null;
  workspace_id: string | null;
}
