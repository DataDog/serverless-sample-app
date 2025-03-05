---
id: Product API
name: Product API
version: 1.0.0
summary: The product service
badges: []
sends:
  - id: productcreatedv1
    version: 1.0.0
  - id: productupdatedv1
    version: 1.0.0
  - id: productdeletedv1
    version: 1.0.0
receives:
  - id: listProducts
    version: 1.0.0
  - id: createProduct
    version: 1.0.0
  - id: updateProduct
    version: 1.0.0
  - id: getProduct
    version: 1.0.0
  - id: deleteProduct
    version: 1.0.0
schemaPath: product-api-events.yml
specifications:
  openapiPath: product-api.yml
  asyncapiPath: product-api-events.yml
owners:
  - product-management
---
## Architecture diagram
<NodeGraph />
