---
id: updateInventory
version: 1.0.0
name: updateInventory
summary: Update a products stock level
schemaPath: request-body.json
badges:
  - content: PUT
    textColor: blue
    backgroundColor: blue
owners:
  - inventory-service
---
## Overview
Used to update the current stock level of a product




## PUT `(/inventory)`




### Request Body
<SchemaViewer file="request-body.json" maxHeight="500" id="request-body" />


### Responses

#### <span className="text-green-500">200 OK</span>
<SchemaViewer file="response-200.json" maxHeight="500" id="response-200" />



## Architecture

<NodeGraph />
