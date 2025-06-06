package com.inventory.api;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;

import java.security.Key;

import javax.crypto.SecretKey;

@ApplicationScoped
public class Authenticator {
    private static final String USER_TYPE_CLAIM = "user_type";
    private static final String ADMIN = "ADMIN";
    private static final Logger LOGGER = Logger.getLogger("Listener");

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

    public boolean AuthorizeStandardAccess(String token) {
        try {
            LOGGER.info(secretString);

            SecretKey secretKey = Keys.hmacShaKeyFor(secretString.getBytes());
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            if (claims.get(USER_TYPE_CLAIM) != null) {
                return false;
            }
        } catch (Exception e) {
            LOGGER.error("User type: " + e.getMessage());
            return false;
        }

        return true;
    }

    public boolean AuthorizeAdmin(String token) {
        try {
            LOGGER.info(secretString);

            SecretKey secretKey = Keys.hmacShaKeyFor(secretString.getBytes());
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            if (!ADMIN.equals(claims.get(USER_TYPE_CLAIM))) {
                return false;
            }
        } catch (Exception e) {
            LOGGER.error("User type: " + e.getMessage());
            return false;
        }

        return true;
    }
}
