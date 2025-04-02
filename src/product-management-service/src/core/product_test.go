package core

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewProduct(t *testing.T) {
	tests := []struct {
		name          string
		productName   string
		price         float32
		expectedError error
		checkProduct  func(*Product)
	}{
		{
			name:          "Valid product creation",
			productName:   "Test Product",
			price:         10.99,
			expectedError: nil,
			checkProduct: func(p *Product) {
				assert.Equal(t, "TESTPRODUCT", p.Id)
				assert.Equal(t, "Test Product", p.Name)
				assert.Equal(t, float32(10.99), p.Price)
				assert.Equal(t, "", p.PreviousName)
				assert.Equal(t, float32(-1), p.PreviousPrice)
				assert.Equal(t, float32(0), p.StockLevel)
				assert.False(t, p.Updated)
				assert.Empty(t, p.PriceBreakdown)
			},
		},
		{
			name:        "Name too short",
			productName: "Ab",
			price:       10.99,
			expectedError: &InvalidProductDetailsError{
				ProductId: "",
				Name:      "Ab",
				Price:     10.99,
			},
			checkProduct: nil,
		},
		{
			name:        "Price is zero",
			productName: "Valid Name",
			price:       0,
			expectedError: &InvalidProductDetailsError{
				ProductId: "",
				Name:      "Valid Name",
				Price:     0,
			},
			checkProduct: nil,
		},
		{
			name:        "Price is negative",
			productName: "Valid Name",
			price:       -5.99,
			expectedError: &InvalidProductDetailsError{
				ProductId: "",
				Name:      "Valid Name",
				Price:     -5.99,
			},
			checkProduct: nil,
		},
		{
			name:          "ID creation with spaces",
			productName:   "Test Product With Spaces",
			price:         10.99,
			expectedError: nil,
			checkProduct: func(p *Product) {
				assert.Equal(t, "TESTPRODUCTWITHSPACES", p.Id)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			product, err := NewProduct(tt.productName, tt.price)

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
				assert.Nil(t, product)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, product)
				if tt.checkProduct != nil {
					tt.checkProduct(product)
				}
			}
		})
	}
}

func TestProduct_UpdateDetail(t *testing.T) {
	tests := []struct {
		name          string
		product       *Product
		newName       string
		newPrice      float32
		expectedError error
		checkProduct  func(*Product)
	}{
		{
			name: "Valid update both name and price",
			product: func() *Product {
				p, _ := NewProduct("Original Name", 10.99)
				return p
			}(),
			newName:       "Updated Name",
			newPrice:      15.99,
			expectedError: nil,
			checkProduct: func(p *Product) {
				assert.Equal(t, "Updated Name", p.Name)
				assert.Equal(t, float32(15.99), p.Price)
				assert.Equal(t, "Original Name", p.PreviousName)
				assert.Equal(t, float32(10.99), p.PreviousPrice)
				assert.True(t, p.Updated)
			},
		},
		{
			name: "Valid update name only",
			product: func() *Product {
				p, _ := NewProduct("Original Name", 10.99)
				return p
			}(),
			newName:       "Updated Name",
			newPrice:      10.99, // Same price
			expectedError: nil,
			checkProduct: func(p *Product) {
				assert.Equal(t, "Updated Name", p.Name)
				assert.Equal(t, float32(10.99), p.Price)
				assert.Equal(t, "Original Name", p.PreviousName)
				assert.Equal(t, float32(-1), p.PreviousPrice) // Price didn't change
				assert.True(t, p.Updated)
			},
		},
		{
			name: "Valid update price only",
			product: func() *Product {
				p, _ := NewProduct("Original Name", 10.99)
				return p
			}(),
			newName:       "Original Name", // Same name
			newPrice:      15.99,
			expectedError: nil,
			checkProduct: func(p *Product) {
				assert.Equal(t, "Original Name", p.Name)
				assert.Equal(t, float32(15.99), p.Price)
				assert.Equal(t, "", p.PreviousName) // Name didn't change
				assert.Equal(t, float32(10.99), p.PreviousPrice)
				assert.True(t, p.Updated)
			},
		},
		{
			name: "No changes",
			product: func() *Product {
				p, _ := NewProduct("Original Name", 10.99)
				return p
			}(),
			newName:       "Original Name", // Same name
			newPrice:      10.99,           // Same price
			expectedError: nil,
			checkProduct: func(p *Product) {
				assert.Equal(t, "Original Name", p.Name)
				assert.Equal(t, float32(10.99), p.Price)
				assert.Equal(t, "", p.PreviousName)
				assert.Equal(t, float32(-1), p.PreviousPrice)
				assert.False(t, p.Updated) // Should not be marked as updated
			},
		},
		{
			name: "Invalid name update",
			product: func() *Product {
				p, _ := NewProduct("Original Name", 10.99)
				return p
			}(),
			newName:  "Ab", // Too short
			newPrice: 15.99,
			expectedError: &InvalidProductDetailsError{
				ProductId: "ORIGINALNAME",
				Name:      "Ab",
				Price:     15.99,
			},
			checkProduct: func(p *Product) {
				// Product should remain unchanged
				assert.Equal(t, "Original Name", p.Name)
				assert.Equal(t, float32(10.99), p.Price)
			},
		},
		{
			name: "Invalid price update",
			product: func() *Product {
				p, _ := NewProduct("Original Name", 10.99)
				return p
			}(),
			newName:  "Updated Name",
			newPrice: -5.99, // Negative price
			expectedError: &InvalidProductDetailsError{
				ProductId: "ORIGINALNAME",
				Name:      "Updated Name",
				Price:     -5.99,
			},
			checkProduct: func(p *Product) {
				// Product should remain unchanged
				assert.Equal(t, "Original Name", p.Name)
				assert.Equal(t, float32(10.99), p.Price)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.product.UpdateDetail(tt.newName, tt.newPrice)

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				assert.NoError(t, err)
			}

			if tt.checkProduct != nil {
				tt.checkProduct(tt.product)
			}
		})
	}
}

func TestProduct_UpdateStockLevel(t *testing.T) {
	t.Run("Update stock level", func(t *testing.T) {
		product, _ := NewProduct("Test Product", 10.99)

		// Initial stock level should be 0
		assert.Equal(t, float32(0), product.StockLevel)

		// Update stock level
		product.UpdateStockLevel(50.5)
		assert.Equal(t, float32(50.5), product.StockLevel)

		// Update stock level again
		product.UpdateStockLevel(0)
		assert.Equal(t, float32(0), product.StockLevel)

		// Update to negative value (should work since there's no validation in the method)
		product.UpdateStockLevel(-10)
		assert.Equal(t, float32(-10), product.StockLevel)
	})
}

func TestProduct_ClearPricing(t *testing.T) {
	t.Run("Clear pricing brackets", func(t *testing.T) {
		product, _ := NewProduct("Test Product", 10.99)

		// Add some price brackets
		product.AddPrice(10, 9.99)
		product.AddPrice(50, 8.99)
		assert.Len(t, product.PriceBreakdown, 2)

		// Clear pricing
		product.ClearPricing()
		assert.Empty(t, product.PriceBreakdown)
	})
}

func TestProduct_AddPrice(t *testing.T) {
	t.Run("Add price brackets", func(t *testing.T) {
		product, _ := NewProduct("Test Product", 10.99)

		// Initially should have no price brackets
		assert.Empty(t, product.PriceBreakdown)

		// Add a price bracket
		product.AddPrice(10, 9.99)
		assert.Len(t, product.PriceBreakdown, 1)
		assert.Equal(t, 10, product.PriceBreakdown[0].Quantity)
		assert.Equal(t, float32(9.99), product.PriceBreakdown[0].Price)

		// Add another price bracket
		product.AddPrice(50, 8.99)
		assert.Len(t, product.PriceBreakdown, 2)
		assert.Equal(t, 50, product.PriceBreakdown[1].Quantity)
		assert.Equal(t, float32(8.99), product.PriceBreakdown[1].Price)
	})
}

func TestProduct_AsDto(t *testing.T) {
	t.Run("Convert product to DTO", func(t *testing.T) {
		product, _ := NewProduct("Test Product", 10.99)
		product.UpdateStockLevel(50)
		product.AddPrice(10, 9.99)
		product.AddPrice(50, 8.99)

		dto := product.AsDto()

		assert.Equal(t, product.Id, dto.ProductId)
		assert.Equal(t, product.Name, dto.Name)
		assert.Equal(t, product.Price, dto.Price)
		assert.Equal(t, product.StockLevel, dto.StockLevel)
		assert.Len(t, dto.PriceBreakdown, 2)
		assert.Equal(t, product.PriceBreakdown[0].Quantity, dto.PriceBreakdown[0].Quantity)
		assert.Equal(t, product.PriceBreakdown[0].Price, dto.PriceBreakdown[0].Price)
		assert.Equal(t, product.PriceBreakdown[1].Quantity, dto.PriceBreakdown[1].Quantity)
		assert.Equal(t, product.PriceBreakdown[1].Price, dto.PriceBreakdown[1].Price)
	})
}

func TestProduct_AsListDto(t *testing.T) {
	t.Run("Convert product to list DTO", func(t *testing.T) {
		product, _ := NewProduct("Test Product", 10.99)
		product.UpdateStockLevel(50)
		product.AddPrice(10, 9.99) // These shouldn't be included in ListDTO

		listDto := product.AsListDto()

		assert.Equal(t, product.Id, listDto.ProductId)
		assert.Equal(t, product.Name, listDto.Name)
		assert.Equal(t, product.Price, listDto.Price)
		assert.Equal(t, product.StockLevel, listDto.StockLevel)
		// PriceBreakdown is not included in ListDTO
	})
}
