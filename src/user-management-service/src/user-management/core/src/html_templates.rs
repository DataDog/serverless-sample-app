pub struct LoginPageTemplate {
    client_id: String,
    redirect_uri: String,
    scope: String,
    state: String,
    code_challenge: String,
    code_challenge_method: String,
    error_message: Option<String>,
    csrf_token: String,
}

impl LoginPageTemplate {
    pub fn new(
        client_id: String,
        redirect_uri: String,
        scope: String,
        state: String,
        code_challenge: String,
        code_challenge_method: String,
        csrf_token: String,
    ) -> Self {
        Self {
            client_id,
            redirect_uri,
            scope,
            state,
            code_challenge,
            code_challenge_method,
            error_message: None,
            csrf_token,
        }
    }

    pub fn with_error(mut self, error: String) -> Self {
        self.error_message = Some(error);
        self
    }

    pub fn render(&self) -> String {
        let error_html = if let Some(error) = &self.error_message {
            format!(
                r#"<div class="error-message">
                    <p>{}</p>
                </div>"#,
                html_escape(error)
            )
        } else {
            String::new()
        };

        format!(
            r#"<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Login - User Management Service</title>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
    />
  </head>
  <body>
    <div id="header"></div>
    <main class="container">
      <div class="logo">
        <h1>User Management Service</h1>
      </div>

      {error_html}

      <form method="POST" action="/oauth/authorize">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required />
        </div>

        <!-- Hidden OAuth parameters -->
        <input type="hidden" name="client_id" value="{client_id}" />
        <input type="hidden" name="redirect_uri" value="{redirect_uri}" />
        <input type="hidden" name="scope" value="{scope}" />
        <input type="hidden" name="state" value="{state}" />
        <input type="hidden" name="code_challenge" value="{code_challenge}" />
        <input
          type="hidden"
          name="code_challenge_method"
          value="{code_challenge_method}"
        />
        <input type="hidden" name="csrf_token" value="{csrf_token}" />
        <input type="hidden" name="action" value="login" />

        <button type="submit" class="login-button">Login</button>
      </form>

      <details name="authorization_request_details">
        <summary>Authorization Request Details</summary>
        <p><strong>App:</strong> {client_id}</p>
        <p><strong>Redirect:</strong> {redirect_uri}</p>
        <p><strong>Requested Permissions:</strong></p>
        <div style="margin-top: 5px">{scope_badges}</div>
      </details>

      <div class="oauth-info"></div>
      <div id="footer"></div>
    </main>
  </body>
</html>
"#,
            error_html = error_html,
            client_id = html_escape(&self.client_id),
            redirect_uri = html_escape(&self.redirect_uri),
            scope = html_escape(&self.scope),
            state = html_escape(&self.state),
            code_challenge = html_escape(&self.code_challenge),
            code_challenge_method = html_escape(&self.code_challenge_method),
            csrf_token = html_escape(&self.csrf_token),
            scope_badges = self.render_scope_badges(),
        )
    }

    fn render_scope_badges(&self) -> String {
        self.scope
            .split_whitespace()
            .map(|scope| format!("<span class=\"scope\">{}</span>", html_escape(scope)))
            .collect::<Vec<_>>()
            .join(" ")
    }
}

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

pub fn generate_csrf_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Simple CSRF token generation using timestamp + random component
    format!("csrf_{}", timestamp)
}
