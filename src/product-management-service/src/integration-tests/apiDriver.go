package integration_tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/golang-jwt/jwt/v5"

	"github.com/aws/aws-sdk-go-v2/service/eventbridge"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
	"github.com/aws/aws-sdk-go-v2/service/ssm"

	"strings"
	"testing"
	"time"

	observability "github.com/datadog/serverless-sample-observability"
)

type ApiResponse[T any] struct {
	Data    T      `json:"data"`
	Message string `json:"message"`
}

type PublicInventoryStockUpdatedEventV1 struct {
	ProductId          string  `json:"productId"`
	NewStockLevel      float64 `json:"newStockLevel"`
	PreviousStockLevel float64 `json:"previousStockLevel"`
}

type PublicPricingUpdatedEventV1 struct {
	ProductId     string          `json:"productId"`
	PriceBrackets []PriceBrackets `json:"priceBrackets"`
}

type PriceBrackets struct {
	Price    float32 `json:"price"`
	Quantity int     `json:"quantity"`
}

type CreateProductCommand struct {
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

type UpdateProductCommand struct {
	ProductId string  `json:"id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
}

type ProductDTO struct {
	ProductId      string          `json:"productId"`
	Name           string          `json:"name"`
	Price          float64         `json:"price"`
	PriceBreakdown []PriceBrackets `json:"pricingBrackets"`
	StockLevel     float64         `json:"stockLevel"`
}

type ApiDriver struct {
	eventBridgeClient           eventbridge.Client
	productStockUpdatedTopicArn string
	apiEndpoint                 string
	secretKey                   string
	busName                     string
}

func NewApiDriver(env string, ssmClient ssm.Client, eventBridgeClient eventbridge.Client) *ApiDriver {
	serviceName := "ProductService"

	paramName := fmt.Sprintf("/%s/%s/api-endpoint", env, serviceName)
	shouldDecrypt := true

	isIntegratedEnvironment := env == "dev" || env == "prod"

	if isIntegratedEnvironment {
		serviceName = "shared"
	}

	req := ssm.GetParameterInput{
		Name:           &paramName,
		WithDecryption: &shouldDecrypt,
	}
	resp, err := ssmClient.GetParameter(context.TODO(), &req)
	if err != nil {
		panic(err)
	}
	accessKeyParameterName := "/%s/%s/secret-access-key"

	secretKeyParamName := fmt.Sprintf(accessKeyParameterName, env, serviceName)
	secretKeyRequest := ssm.GetParameterInput{
		Name:           &secretKeyParamName,
		WithDecryption: &shouldDecrypt,
	}
	secretKeyResponse, secretKeyErr := ssmClient.GetParameter(context.TODO(), &secretKeyRequest)
	if secretKeyErr != nil {
		panic(secretKeyErr)
	}
	busNameParamName := fmt.Sprintf("/%s/%s/event-bus-name", env, serviceName)
	eventBusRequest := ssm.GetParameterInput{
		Name:           &busNameParamName,
		WithDecryption: &shouldDecrypt,
	}
	eventBusResponse, eventBusErr := ssmClient.GetParameter(context.TODO(), &eventBusRequest)
	if eventBusErr != nil {
		panic(eventBusErr)
	}
	return &ApiDriver{
		apiEndpoint:       *resp.Parameter.Value,
		secretKey:         *secretKeyResponse.Parameter.Value,
		eventBridgeClient: eventBridgeClient,
		busName:           *eventBusResponse.Parameter.Value,
	}
}

func (a *ApiDriver) ListProducts(t *testing.T) *http.Response {
	fmt.Print(a.apiEndpoint)
	req, err := http.NewRequest("GET", a.apiEndpoint+"/product", nil)
	if err != nil {
		return nil
	}
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{}

	response, err := client.Do(req)

	if err != nil {
		t.Fatalf("Error while listing products: %v", err)
	}

	return response
}

func (a *ApiDriver) GetProduct(t *testing.T, id string) *http.Response {
	req, err := http.NewRequest("GET", a.apiEndpoint+"/product/"+id, nil)
	if err != nil {
		return nil
	}
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{}

	response, err := client.Do(req)

	if err != nil {
		t.Fatalf("Error while listing products: %v", err)
	}

	return response
}

func (a *ApiDriver) CreateProduct(t *testing.T, command CreateProductCommand) *http.Response {
	body, err := json.Marshal(command)
	if err != nil {
		return nil
	}

	bodyReader := strings.NewReader(string(body))
	req, err := http.NewRequest("POST", a.apiEndpoint+"/product", bodyReader)

	if err != nil {
		return nil
	}
	req.Header.Add("Content-Type", "application/json")

	jwt, err := a.generateJWT(a.secretKey)
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", jwt))

	client := &http.Client{}

	response, err := client.Do(req)

	if err != nil {
		t.Fatalf("Error while listing products: %v", err)
	}

	return response
}

func (a *ApiDriver) UpdateProduct(t *testing.T, command UpdateProductCommand) *http.Response {
	body, err := json.Marshal(command)
	if err != nil {
		return nil
	}

	bodyReader := strings.NewReader(string(body))
	req, err := http.NewRequest("PUT", a.apiEndpoint+"/product", bodyReader)

	if err != nil {
		return nil
	}
	req.Header.Add("Content-Type", "application/json")

	jwt, err := a.generateJWT(a.secretKey)
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", jwt))

	client := &http.Client{}

	response, err := client.Do(req)

	if err != nil {
		t.Fatalf("Error while listing products: %v", err)
	}

	return response
}

func (a *ApiDriver) DeleteProduct(t *testing.T, id string) *http.Response {
	req, err := http.NewRequest("DELETE", a.apiEndpoint+"/product/"+id, nil)
	if err != nil {
		return nil
	}
	req.Header.Add("Content-Type", "application/json")

	jwt, err := a.generateJWT(a.secretKey)
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", jwt))

	client := &http.Client{}

	response, err := client.Do(req)

	if err != nil {
		t.Fatalf("Error while listing products: %v", err)
	}

	return response
}

func (a *ApiDriver) InjectProductStockUpdatedEvent(t *testing.T, productId string, newStockLevel float64) {
	// Create the SNS message
	stockUpdatedEvent := PublicInventoryStockUpdatedEventV1{
		ProductId:          productId,
		NewStockLevel:      newStockLevel,
		PreviousStockLevel: 20,
	}
	var tracedMessage = observability.NewCloudEvent(context.TODO(), "inventory.stockUpdated.v1", stockUpdatedEvent)
	evtData, _ := json.Marshal(tracedMessage)
	message := string(evtData)

	detailType := "inventory.stockUpdated.v1"
	source := fmt.Sprintf("%s.inventory", os.Getenv("ENV"))

	t.Logf("Publishing event to event bus %s with detail type %s and source %s", a.busName, detailType, source)

	entiries := []types.PutEventsRequestEntry{
		{
			Detail:       &message,
			DetailType:   &detailType,
			EventBusName: &a.busName,
			Source:       &source,
		},
	}

	input := &eventbridge.PutEventsInput{
		Entries: entiries,
	}

	_, err := a.eventBridgeClient.PutEvents(context.TODO(), input)

	if err != nil {
		t.Fatalf("Failure publishing, error: %s", err)
	}
}

func (a *ApiDriver) InjectPricingChangedEvent(t *testing.T, productId string) {
	// Create the SNS message
	stockUpdatedEvent := PublicPricingUpdatedEventV1{
		ProductId: productId,
		PriceBrackets: []PriceBrackets{
			{
				Price:    10,
				Quantity: 1,
			},
		},
	}
	var tracedMessage = observability.NewCloudEvent(context.TODO(), "pricing.pricingCalculated.v1", stockUpdatedEvent)
	evtData, _ := json.Marshal(tracedMessage)
	message := string(evtData)

	detailType := "pricing.pricingCalculated.v1"
	source := fmt.Sprintf("%s.pricing", os.Getenv("ENV"))

	t.Logf("Publishing event to event bus %s with detail type %s and source %s", a.busName, detailType, source)

	entiries := []types.PutEventsRequestEntry{
		{
			Detail:       &message,
			DetailType:   &detailType,
			EventBusName: &a.busName,
			Source:       &source,
		},
	}

	input := &eventbridge.PutEventsInput{
		Entries: entiries,
	}

	_, err := a.eventBridgeClient.PutEvents(context.TODO(), input)

	if err != nil {
		t.Fatalf("Failure publishing, error: %s", err)
	}
}

func (a *ApiDriver) generateJWT(secretKey string) (string, error) {
	// Define the claims
	claims := jwt.MapClaims{
		"sub":       "admin@serverless-sample.com",
		"user_type": "ADMIN",
		"exp":       time.Now().Add(time.Hour * 1).Unix(), // Token expires in 1 hour
		"iat":       time.Now().Unix(),
	}

	// Create the token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign the token with the secret key
	tokenString, err := token.SignedString([]byte(secretKey))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}
