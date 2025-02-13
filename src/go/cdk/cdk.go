package main

import (
	analyticsservice "cdk/analytics-service"
	inventoryorderingservice "cdk/inventory-ordering-service"
	inventoryacl "cdk/inventoryAcl"
	inventoryapi "cdk/inventoryApi"
	productacl "cdk/productAcl"
	productapi "cdk/productApi"
	productapiworker "cdk/productApiWorker"
	productpricingservice "cdk/productPricingService"
	producteventpublisher "cdk/productPublicEventPublisher"
	"cdk/shared"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/jsii-runtime-go"
)

func main() {
	defer jsii.Close()

	app := awscdk.NewApp(nil)

	sharedResourcesStack := shared.NewSharedResourceStack(app, "GoSharedResourcesStack", &shared.SharedResourceStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})

	productAcl := productacl.NewProductAclStack(app, "GoProductAclStack", &productacl.ProductAclStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})
	productAcl.AddDependency(sharedResourcesStack, jsii.String("Requires event bus"))

	productApiStack := productapi.NewProductApiStack(app, "GoProductApiStack", &productapi.ProductApiStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})

	productPricingStack := productpricingservice.NewProductPricingServiceStack(app, "GoProductPricingStack", &productpricingservice.ProductPricingStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})
	productPricingStack.AddDependency(productApiStack, jsii.String("Receives events published by the ProductAPI"))

	productApiWorkerStack := productapiworker.NewProductApiWorkerStack(app, "GoProductApiWorker", &productapiworker.ProductApiWorkerStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})
	productApiWorkerStack.AddDependency(productPricingStack, jsii.String("Receives events published by the pricing service"))
	productApiWorkerStack.AddDependency(productAcl, jsii.String("Receives events published by the anti corruption layer"))

	productEventPublisherStack := producteventpublisher.NewProductPublicEventPublisherStack(app, "GoProductEventPublisher", &producteventpublisher.ProductPublicEventPublisherStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})
	productEventPublisherStack.AddDependency(sharedResourcesStack, jsii.String("Requires event bus"))
	productEventPublisherStack.AddDependency(productApiStack, jsii.String("Requires SNS topics"))

	inventoryApi := inventoryapi.NewInventoryApiStack(app, *jsii.String("GoInventoryApi"), &inventoryapi.InventoryApiStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})
	inventoryApi.AddDependency(sharedResourcesStack, jsii.String("Requires event bus"))

	inventoryAcl := inventoryacl.NewInventoryAclStack(app, *jsii.String("GoInventoryAcl"), &inventoryacl.InventoryAclStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})
	inventoryAcl.AddDependency(sharedResourcesStack, jsii.String("Requires event bus"))

	inventoryOrderingService := inventoryorderingservice.NewInventoryOrderingServiceStack(app, *jsii.String("GoInventoryOrderingService"), &inventoryorderingservice.InventoryOrderingServiceStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})
	inventoryOrderingService.AddDependency(inventoryAcl, jsii.String("Requires SNS topics"))
	inventoryApi.AddDependency(inventoryApi, jsii.String("Requires DynamoDB table to exist"))

	analyticsService := analyticsservice.NewAnalyticsServiceStack(app, *jsii.String("GoAnalyticsService"), &analyticsservice.AnalyticsServiceStackProps{
		StackProps: awscdk.StackProps{
			Env: env(),
		},
	})
	analyticsService.AddDependency(sharedResourcesStack, jsii.String("Requires event bus"))

	app.Synth(nil)
}

// env determines the AWS environment (account+region) in which our stack is to
// be deployed. For more information see: https://docs.aws.amazon.com/cdk/latest/guide/environments.html
func env() *awscdk.Environment {
	// If unspecified, this stack will be "environment-agnostic".
	// Account/Region-dependent features and context lookups will not work, but a
	// single synthesized template can be deployed anywhere.
	//---------------------------------------------------------------------------
	return nil

	// Uncomment if you know exactly what account and region you want to deploy
	// the stack to. This is the recommendation for production stacks.
	//---------------------------------------------------------------------------
	// return &awscdk.Environment{
	//  Account: jsii.String("123456789012"),
	//  Region:  jsii.String("us-east-1"),
	// }

	// Uncomment to specialize this stack for the AWS Account and Region that are
	// implied by the current CLI configuration. This is recommended for dev
	// stacks.
	//---------------------------------------------------------------------------
	// return &awscdk.Environment{
	//  Account: jsii.String(os.Getenv("CDK_DEFAULT_ACCOUNT")),
	//  Region:  jsii.String(os.Getenv("CDK_DEFAULT_REGION")),
	// }
}
