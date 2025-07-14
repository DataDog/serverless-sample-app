// OAuth 2.1 Types for MCP Server

export interface TokenClaims {
  sub: string; // User ID
  username: string; // Username
  client_id: string; // OAuth client ID
  scope: string; // Space-separated scopes
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

export interface UserContext {
  userId: string;
  username: string;
  clientId: string;
  scopes: string[];
  isAuthenticated: boolean;
}

export interface OAuthError {
  error: string;
  error_description?: string;
}

export enum Scope {
  READ = "read",
  WRITE = "write",
}

export interface PKCEParams {
  code_challenge: string;
  code_challenge_method: string;
  code_verifier: string;
}

export interface AuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string[];
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  code_verifier: string;
  nonce: string;
}

export interface TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  code_verifier?: string;
  refresh_token?: string;
  username?: string;
  password?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}
