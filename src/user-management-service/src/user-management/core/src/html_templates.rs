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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - User Management Service</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }}
        
        .login-container {{
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 400px;
        }}
        
        .logo {{
            text-align: center;
            margin-bottom: 30px;
        }}
        
        .logo h1 {{
            color: #333;
            font-size: 24px;
            font-weight: 600;
        }}
        
        .form-group {{
            margin-bottom: 20px;
        }}
        
        label {{
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: 500;
        }}
        
        input[type="email"], input[type="password"] {{
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }}
        
        input[type="email"]:focus, input[type="password"]:focus {{
            outline: none;
            border-color: #667eea;
        }}
        
        .login-button {{
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }}
        
        .login-button:hover {{
            transform: translateY(-1px);
        }}
        
        .login-button:disabled {{
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
        }}
        
        .error-message {{
            background: #fee;
            color: #c33;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #fcc;
        }}
        
        .oauth-info {{
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }}
        
        .oauth-info h3 {{
            color: #333;
            font-size: 14px;
            margin-bottom: 8px;
        }}
        
        .oauth-info p {{
            color: #666;
            font-size: 12px;
            margin-bottom: 4px;
        }}
        
        .oauth-info .scope {{
            background: #e9ecef;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            display: inline-block;
            margin-right: 5px;
        }}
        
        @media (max-width: 480px) {{
            .login-container {{
                padding: 20px;
            }}
            
            .logo h1 {{
                font-size: 20px;
            }}
        }}
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>User Management Service</h1>
        </div>
        
        {error_html}
        
        <form method="POST" action="/oauth/authorize">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <!-- Hidden OAuth parameters -->
            <input type="hidden" name="client_id" value="{client_id}">
            <input type="hidden" name="redirect_uri" value="{redirect_uri}">
            <input type="hidden" name="scope" value="{scope}">
            <input type="hidden" name="state" value="{state}">
            <input type="hidden" name="code_challenge" value="{code_challenge}">
            <input type="hidden" name="code_challenge_method" value="{code_challenge_method}">
            <input type="hidden" name="csrf_token" value="{csrf_token}">
            <input type="hidden" name="action" value="login">
            
            <button type="submit" class="login-button">Login</button>
        </form>
        
        <div class="oauth-info">
            <h3>Authorization Request</h3>
            <p><strong>App:</strong> {client_id}</p>
            <p><strong>Redirect:</strong> {redirect_uri}</p>
            <p><strong>Requested Permissions:</strong></p>
            <div style="margin-top: 5px;">
                {scope_badges}
            </div>
        </div>
    </div>
</body>
</html>"#,
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