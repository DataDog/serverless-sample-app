export class MetadataService {
  private mcpServerBaseUrl: string;
  private authServerBaseUrl: string;

  constructor(mcpServerBaseUrl: string, authServerBaseUrl: string) {
    this.mcpServerBaseUrl = mcpServerBaseUrl.replace(/\/$/, "");
    this.authServerBaseUrl = authServerBaseUrl.replace(/\/$/, "");
  }

  /**
   * Returns OAuth 2.0 Authorization Server Metadata (RFC 8414)
   */
  getAuthorizationServer(): object {
    const scopes = ["read", "write", "openid", "profile", "email"];

    return {
      issuer: this.authServerBaseUrl,
      authorization_endpoint: `${this.authServerBaseUrl}/oauth/authorize`,
      token_endpoint: `${this.authServerBaseUrl}/oauth/token`,
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
      token_endpoint_auth_signing_alg_values_supported: ["HS256"],
      userinfo_endpoint: `${this.authServerBaseUrl}/oauth/userinfo`,
      registration_endpoint: `${this.authServerBaseUrl}/oauth/register`,
      registration_endpoint_auth_methods_supported: ["none"],
      registration_endpoint_auth_signing_alg_values_supported: ["none"],
      scopes_supported: scopes,
      response_types_supported: ["code"],
      response_modes_supported: ["query", "fragment"],
      grant_types_supported: [
        "authorization_code",
        "refresh_token",
        "password",
      ],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["HS256"],
      request_object_signing_alg_values_supported: ["HS256"],
      request_parameter_supported: false,
      request_uri_parameter_supported: false,
      require_request_uri_registration: false,
      claims_parameter_supported: false,
      revocation_endpoint: `${this.authServerBaseUrl}/oauth/revoke`,
      revocation_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
      introspection_endpoint: `${this.authServerBaseUrl}/oauth/introspect`,
      introspection_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
      code_challenge_methods_supported: ["S256"],
      pkce_required: true, // OAuth 2.1 requires PKCE
      claims_supported: [
        "sub",
        "username",
        "client_id",
        "scope",
        "exp",
        "iat",
        "iss",
      ],
      // MCP-specific extensions
      mcp_extensions: {
        server_info_endpoint: `${this.mcpServerBaseUrl}/info`,
        sse_endpoint: `${this.mcpServerBaseUrl}/sse`,
        mcp_endpoint: `${this.mcpServerBaseUrl}/mcp`,
        supported_protocols: ["mcp", "sse"],
        tools_discovery_endpoint: `${this.mcpServerBaseUrl}/mcp/tools`,
        resource_indicators_supported: true, // RFC 8707
        supported_resources: [],
      },
      // RFC 7592 Dynamic Client Registration Management
      registration_client_uri_template: `${this.authServerBaseUrl}/oauth/register/{client_id}`,
      registration_access_token_endpoint: `${this.authServerBaseUrl}/oauth/register/{client_id}`,
      // Standard metadata
      service_documentation: `${this.authServerBaseUrl}/docs`,
      ui_locales_supported: ["en-US"],
      op_policy_uri: `${this.authServerBaseUrl}/policy`,
      op_tos_uri: `${this.authServerBaseUrl}/terms`,
      jwks_uri: `${this.mcpServerBaseUrl}/.well-known/jwks.json`,
    };
  }

  /**
   * Returns OAuth 2.0 Protected Resource Metadata (RFC 8414)
   */
  getResourceMetadata(): object {
    const baseUrl = this.authServerBaseUrl;
    const scopes = ["read", "write"]; // Example scopes, replace with actual from env

    return {
      resource: this.mcpServerBaseUrl,
      authorization_servers: [baseUrl], // Point to self as authorization server
      scopes_supported: scopes,
      bearer_methods_supported: ["header"],
      resource_documentation: `${baseUrl}/docs`,
      resource_policy_uri: `${baseUrl}/policy`,
      resource_tos_uri: `${baseUrl}/terms`,
      introspection_endpoint: `${baseUrl}/oauth/introspect`,
      introspection_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      revocation_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
    };
  }

  /**
   * Returns JSON Web Key Set (JWKS) for token verification
   */
  getJWKS(): object {
    // In a production environment, you would expose your public keys here
    // For symmetric keys (HS256), you don't expose the actual secret
    return {
      keys: [
        {
          kty: "oct",
          use: "sig",
          kid: "mcp-server-key-1",
          alg: "HS256",
          // Note: For symmetric keys, we don't expose the actual key material
          // This is just metadata about the key
        },
      ],
    };
  }
}
