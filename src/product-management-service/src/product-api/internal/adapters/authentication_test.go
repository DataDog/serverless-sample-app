package adapters

import (
	"context"
	"testing"
)

func TestAuthenticator_WhenValidAdminJWTIsPassed_ShouldReturnValidJWT(t *testing.T) {
	secret := "e6f98ae4-507f-4596-9feb-430a98cbdd39"
	authenticator := NewAuthenticator(secret)

	ctx := context.Background()
	authHeader := "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkBzZXJ2ZXJsZXNzLXNhbXBsZS5jb20iLCJ1c2VyX3R5cGUiOiJBRE1JTiIsImV4cCI6MTczOTg5NzMyMiwiaWF0IjoxNzM5ODEwOTIyfQ.dDu1KJkl7VjV2TUprr1ag47LCHXC6acgVXI3T8FlThA"

	// Test valid token
	claims, err := authenticator.Authenticate(ctx, authHeader)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if claims.Sub != "admin@serverless-sample.com" {
		t.Errorf("Expected sub to be 'admin@serverless-sample.com', got %v", claims.Sub)
	}

	if claims.UserType != "ADMIN" {
		t.Errorf("Expected user_type to be 'ADMIN', got %v", claims.UserType)
	}
}
