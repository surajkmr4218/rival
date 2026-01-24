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
