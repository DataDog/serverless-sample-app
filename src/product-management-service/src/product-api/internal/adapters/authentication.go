package adapters

import (
	"context"
	"fmt"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
	"github.com/dgrijalva/jwt-go"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
	"os"
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

func NewAuthenticator(ctx context.Context, ssmClient ssm.Client) *Authenticator {
	secretAccessKeyParameterName := os.Getenv("JWT_SECRET_PARAM_NAME")

	secretAccessKeyParameter, err := ssmClient.GetParameter(ctx, &ssm.GetParameterInput{
		Name: &secretAccessKeyParameterName,
	})

	if err != nil {
		panic(err)
	}
	return &Authenticator{secretAccessKey: *secretAccessKeyParameter.Parameter.Value}
}

func (a *Authenticator) AuthenticateAPIGatewayRequest(ctx context.Context, request events.APIGatewayProxyRequest, expectedUserType string) (*Claims, error) {
	authHeader := request.Headers["Authorization"]
	if authHeader == "" {
		return nil, fmt.Errorf("missing Authorization header")
	}
	claims, authError := a.Authenticate(ctx, authHeader)
	if authError != nil {
		return nil, fmt.Errorf("invalid token")
	}

	if claims.UserType != expectedUserType {
		return nil, fmt.Errorf("user forbidden")
	}

	return claims, nil
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
