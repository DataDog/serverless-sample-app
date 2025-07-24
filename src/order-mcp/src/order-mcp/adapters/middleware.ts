import { JWTService } from "./jwtService";
import { Scope, UserContext } from "./types";
import express, { RequestHandler } from "express";

export class AuthMiddleware {
  private jwtService: JWTService;

  constructor(authServerBaseUrl: string, jwtSecret: string) {
    this.jwtService = new JWTService(authServerBaseUrl, jwtSecret);
  }

  /**
   * Authenticates request and returns user context
   */
  async authenticate(
    request: express.Request
  ): Promise<{ userContext: UserContext | null; response?: Response }> {
    console.log(`Authenticating request: ${request.method} ${request.url}`);

    // Extract authorization header
    const authHeader = request.get("Authorization");
    if (!authHeader) {
      return {
        userContext: null,
        response: this.jwtService.createOAuthError(
          "invalid_token",
          "Missing Authorization header"
        ),
      };
    }

    // Extract Bearer token
    const token = this.jwtService.extractBearerToken(authHeader);

    console.log(`Extracted token: ${token}`);

    if (!token) {
      return {
        userContext: null,
        response: this.jwtService.createOAuthError(
          "invalid_token",
          "Invalid Authorization header format"
        ),
      };
    }

    console.log(`Authenticating token: ${token}`);

    // Validate token
    const userContext = await this.jwtService.validateAccessToken(token);

    console.log(
      `User context after validation: ${JSON.stringify(userContext)}`
    );

    if (!userContext) {
      console.log(
        `Token validation failed, trying introspection for token: ${token}`
      );
      // Try introspection as fallback
      const introspectedContext = await this.jwtService.introspectToken(token);
      if (!introspectedContext) {
        console.log(`Introspection failed for token: ${token}`);
        return {
          userContext: null,
          response: this.jwtService.createOAuthError(
            "invalid_token",
            "Token validation failed"
          ),
        };
      }
      return { userContext: introspectedContext };
    }

    return { userContext };
  }

  /**
   * Checks if user has required scope for a tool
   */
  async requireScope(
    userContext: UserContext,
    requiredScope: Scope
  ): Promise<Response | null> {
    console.log(
      `Checking scope. User scopes: [${userContext.scopes.join(
        ", "
      )}], Required: ${requiredScope}`
    );

    if (!this.jwtService.hasScope(userContext, requiredScope)) {
      console.log(
        `Scope check failed. User scopes: [${userContext.scopes.join(
          ", "
        )}], Required: ${requiredScope}`
      );
      return this.jwtService.createOAuthError(
        "insufficient_scope",
        `Required scope: ${requiredScope}. Available scopes: ${userContext.scopes.join(
          ", "
        )}`
      );
    }

    console.log(`Scope check passed for: ${requiredScope}`);
    return null;
  }

  /**
   * Checks if user has any of the required scopes
   */
  async requireAnyScope(
    userContext: UserContext,
    requiredScopes: Scope[]
  ): Promise<Response | null> {
    if (!this.jwtService.hasAnyScope(userContext, requiredScopes)) {
      return this.jwtService.createOAuthError(
        "insufficient_scope",
        `Required scopes: ${requiredScopes.join(", ")}`
      );
    }
    return null;
  }

  /**
   * Creates CORS headers for OAuth endpoints
   */
  createCORSHeaders(): HeadersInit {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };
  }

  /**
   * Handles CORS preflight requests
   */
  handleCORSPreflight(): Response {
    return new Response(null, {
      status: 204,
      headers: this.createCORSHeaders(),
    });
  }

  /**
   * Adds CORS headers to response
   */
  addCORSHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    Object.entries(this.createCORSHeaders()).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
