package integration_tests

import (
	"context"
	"github.com/Microsoft/go-winio/pkg/guid"
	"github.com/aws/aws-sdk-go-v2/aws"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"os"
	"testing"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	ssmClient         = *ssm.NewFromConfig(awsCfg)
	eventBridgeClient = *eventbridge.NewFromConfig(awsCfg)
	apiDriver         = NewApiDriver(os.Getenv("ENV"), ssmClient, eventBridgeClient)
)

func TestProductEndToEndProcess(t *testing.T) {
	randomId, _ := guid.NewV4()
	productNameUnderTest := randomId.String()
	priceUnderTest := 10.0
	_ = 10.0

	_ = apiDriver.CreateProduct(t, CreateProductCommand{Name: productNameUnderTest, Price: priceUnderTest})

	//if createdProductResult.StatusCode != 201 {
	//	t.Fatalf("Expected status code 201, but got %d", createdProductResult.StatusCode)
	//}
	//
	//var product ApiResponse[ProductDTO]
	//if err := json.NewDecoder(createdProductResult.Body).Decode(&product); err != nil {
	//	t.Fatalf("Error decoding product: %v", err)
	//}
	//
	//if product.Data.Name != productNameUnderTest {
	//	t.Fatalf("Expected product name to be %s, but got %s", productNameUnderTest, product.Data.Name)
	//}
	//
	//apiDriver.InjectProductStockUpdatedEvent(t, product.Data.ProductId, stockLevelUnderTest)
	//
	//// Wait for the event to be processed
	//time.Sleep(5 * time.Second)
	//
	//apiDriver.InjectPricingChangedEvent(t, product.Data.ProductId)
	//
	//// Wait for the event to be processed
	//time.Sleep(5 * time.Second)
	//
	//updateProductBody := apiDriver.UpdateProduct(t, UpdateProductCommand{ProductId: product.Data.ProductId, Name: "updated-product", Price: 20.0})
	//
	//if updateProductBody.StatusCode != 200 {
	//	t.Fatalf("Expected update product status code 200, but got %d", updateProductBody.StatusCode)
	//}
	//
	//getProductResult := apiDriver.GetProduct(t, product.Data.ProductId)
	//
	//var getProduct ApiResponse[ProductDTO]
	//if err := json.NewDecoder(getProductResult.Body).Decode(&getProduct); err != nil {
	//	t.Fatalf("Error decoding product: %v", err)
	//}
	//
	//if getProduct.Data.StockLevel != stockLevelUnderTest {
	//	t.Fatalf("Expected stock level to be %f, but got %f", stockLevelUnderTest, getProduct.Data.StockLevel)
	//}
	//
	//if len(getProduct.Data.PriceBreakdown) <= 0 {
	//	t.Fatalf("Expected at least one price bracket, but got none")
	//}
	//
	//listedProducts := apiDriver.ListProducts(t)
	//
	//if listedProducts.StatusCode != 200 {
	//	t.Fatalf("Expected status code 200, but got %d", listedProducts.StatusCode)
	//}
	//
	//var productList ApiResponse[[]ProductDTO]
	//if err := json.NewDecoder(listedProducts.Body).Decode(&productList); err != nil {
	//	t.Fatalf("Error decoding product: %v", err)
	//}
	//
	//if len(productList.Data) <= 0 {
	//	t.Fatalf("Expected at least one product to be listed, but got none")
	//}
	//
	//deleteProductResult := apiDriver.DeleteProduct(t, product.Data.ProductId)
	//
	//if deleteProductResult.StatusCode != 200 {
	//	t.Fatalf("Expected status code 200, but got %d", listedProducts.StatusCode)
	//}
}
