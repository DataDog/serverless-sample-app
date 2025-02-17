package com.inventory.api.adapters;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.enterprise.context.ApplicationScoped;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;

import java.security.Key;

@ApplicationScoped
public class Authenticator {
    private static final String USER_TYPE_CLAIM = "user_type";
    private static final String ADMIN = "ADMIN";

    private final SsmClient ssmClient;
    private final String secretString;

    public Authenticator(SsmClient ssmClient) {
        this.ssmClient = ssmClient;

        secretString = this.ssmClient.getParameter(GetParameterRequest.builder()
                .name(System.getenv("JWT_SECRET_PARAM_NAME"))
                .withDecryption(true)
                .build())
                .parameter()
                .value();
    }

    public boolean Authorize(String token) {
        try {
            Key key = Keys.hmacShaKeyFor(secretString.getBytes());
            Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();

            if (!ADMIN.equals(claims.get(USER_TYPE_CLAIM))) {
                return false;
            }
        } catch (Exception e) {
            return false;
        }

        return true;
    }
}
