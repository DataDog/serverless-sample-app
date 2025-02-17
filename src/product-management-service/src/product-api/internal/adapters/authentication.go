package adapters

import (
	"context"
	"fmt"
	"github.com/dgrijalva/jwt-go"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
	"strings"
	"time"
)

type Authenticator struct {
	secretAccessKey string
}

type Claims struct {
	Sub      string `json:"sub"`
	UserType string `json:"user_type"`
	Exp      int    `json:"exp"`
	Iat      int    `json:"iat"`
}

func (c Claims) Valid() error {
	if c.Exp < int(time.Now().Unix()) {
		return fmt.Errorf("token has expired")
	}
	return nil
}

func NewAuthenticator(secretAccessKey string) *Authenticator {
	return &Authenticator{secretAccessKey: secretAccessKey}
}

func (a *Authenticator) Authenticate(ctx context.Context, authHeader string) (*Claims, error) {
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("auth.authenticating", "true")

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")

	return a.verifyToken(ctx, tokenString)
}

func (a *Authenticator) verifyToken(ctx context.Context, tokenString string) (*Claims, error) {
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("auth.verifying", "true")

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			span.SetTag("auth.error", "unexpected signing method")

			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(a.secretAccessKey), nil
	})

	if err != nil {
		span.SetTag("auth.error", err.Error())
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	} else {
		span.SetTag("auth.error", "Invalid token")
		return nil, fmt.Errorf("invalid token")
	}
}
