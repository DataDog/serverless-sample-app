---
id: getStockByProductId
version: 1.0.0
name: getStockByProductId
summary: Get the stock level for a product
schemaPath: ''
badges:
  - content: GET
    textColor: blue
    backgroundColor: blue
owners:
  - inventory-service
---
## Overview
Returns the stock information for an existing product




## GET `(/inventory/{productId})`

### Parameters
- **productId** (path) (required): ID of product to return




### Responses

#### <span className="text-green-500">200 OK</span>
<SchemaViewer file="response-200.json" maxHeight="500" id="response-200" />



## Architecture

<NodeGraph />
