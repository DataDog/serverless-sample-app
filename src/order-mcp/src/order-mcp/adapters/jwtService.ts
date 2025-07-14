import { jwtVerify, importSPKI, createRemoteJWKSet } from "jose";
import { env } from "process";
import { OAuthError, TokenClaims, UserContext } from "./types";

export class JWTService {
  private authServerBaseUrl: string;
  private jwtSecret: string;

  constructor(authServerBaseUrl: string, jwtSecret: string) {
    this.authServerBaseUrl = authServerBaseUrl.replace(/\/$/, "");
    this.jwtSecret = jwtSecret;
  }

  /**
   * Validates a JWT access token and extracts user context
   */
  async validateAccessToken(token: string): Promise<UserContext | null> {
    try {
      // For symmetric key validation (HS256)
      const secret = new TextEncoder().encode(this.jwtSecret);

      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
      });

      console.log(`JWT payload: ${JSON.stringify(payload)}`);

      const claims = payload as unknown as TokenClaims;

      // Validate token claims
      if (!claims.sub) {
        return null;
      }

      // Handle scope claim - it might be missing for some tokens
      const scopes = claims.scope
        ? claims.scope.split(" ").filter((s: string) => s.length > 0)
        : [];

      console.log(
        `JWT validation successful. User: ${
          claims.username
        }, Scopes: ${scopes.join(", ")}`
      );

      return {
        userId: claims.sub,
        username: claims.username || "unknown",
        clientId: claims.client_id || "unknown",
        scopes,
        isAuthenticated: true,
      };
    } catch (error) {
      console.error("JWT validation failed:", error);
      return null;
    }
  }

  /**
   * Validates access token via introspection endpoint (alternative approach)
   */
  async introspectToken(token: string): Promise<UserContext | null> {
    try {
      const response = await fetch(
        `${this.authServerBaseUrl}/oauth/introspect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token }),
        }
      );

      if (!response.ok) {
        return null;
      }

      const introspectionResponse = (await response.json()) as any;

      if (!introspectionResponse.active) {
        return null;
      }

      // Parse scopes
      const scopes = introspectionResponse.scope
        ? introspectionResponse.scope
            .split(" ")
            .filter((s: string) => s.length > 0)
        : [];

      return {
        userId: introspectionResponse.sub || "unknown",
        username: introspectionResponse.username || "unknown",
        clientId: introspectionResponse.client_id || "unknown",
        scopes,
        isAuthenticated: true,
      };
    } catch (error) {
      console.error("Token introspection failed:", error);
      return null;
    }
  }

  /**
   * Extracts Bearer token from Authorization header
   */
  extractBearerToken(authHeader: string | null): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * Checks if user has required scope
   */
  hasScope(userContext: UserContext, requiredScope: string): boolean {
    return userContext.scopes.includes(requiredScope);
  }

  /**
   * Checks if user has any of the required scopes
   */
  hasAnyScope(userContext: UserContext, requiredScopes: string[]): boolean {
    return requiredScopes.some((scope) => userContext.scopes.includes(scope));
  }

  /**
   * Creates OAuth error response
   */
  createOAuthError(error: string, description?: string): Response {
    const errorResponse: OAuthError = {
      error,
      error_description: description,
    };

    return new Response(JSON.stringify(errorResponse), {
      status:
        error === "invalid_token"
          ? 401
          : error === "insufficient_scope"
          ? 403
          : 400,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer realm="${
          this.authServerBaseUrl
        }", error="${error}"${
          description ? `, error_description="${description}"` : ""
        }`,
      },
    });
  }
}
