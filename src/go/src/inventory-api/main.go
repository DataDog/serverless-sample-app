package main

import (
	"context"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"inventory-api/src/adapters"
	"inventory-api/src/adapters/handlers"
	"inventory-api/src/core/services"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"log/slog"

	gintrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/gin-gonic/gin"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

func main() {
	configureObservability()

	awsCfg, err := awscfg.LoadDefaultConfig(context.Background())

	if err != nil {
		slog.Error("Failure starting service due to Google client configuration error. Exiting...")
		panic("Failure starting service due to Google client configuration error. Exiting...")
	}

	awstrace.AppendMiddleware(&awsCfg)
	dynamoDbClient := dynamodb.NewFromConfig(awsCfg)
	eventBridgeClient := eventbridge.NewFromConfig(awsCfg)

	inventoryItemRepository := adapters.NewDynamoDbProductRepository(*dynamoDbClient, os.Getenv("TABLE_NAME"))
	ebEventPublisher := adapters.NewEventBridgeEventPublisher(*eventBridgeClient)

	inventoryService := services.NewInventoryService(inventoryItemRepository, ebEventPublisher)
	inventoryHttpHandler := handlers.NewInventoryHTTPHandler(inventoryService)

	healthCheckHttpHandler := handlers.NewHealthHTTPHandler()

	router := gin.New()

	router.Use(gintrace.Middleware(os.Getenv("DD_SERVICE")))
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	router.POST("/inventory", inventoryHttpHandler.Post)
	router.GET("/inventory/:id", inventoryHttpHandler.Get)
	router.GET("/health", healthCheckHttpHandler.HealthCheck)

	router.Run(":8080")

	slog.Info("Running on port 8080")

	defer tracer.Stop()
}

func configureObservability() {
	tracer.Start(
		tracer.WithEnv(os.Getenv("DD_ENV")),
		tracer.WithService(os.Getenv("DD_SERVICE")),
		tracer.WithServiceVersion(os.Getenv("DD_VERSION")),
	)

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
}
