---
id: completeOrder
version: 1.0.0
name: completeOrder
summary: Complete an order
schemaPath: request-body.json
badges:
  - content: POST
    textColor: blue
    backgroundColor: blue
owners:
  - order-management
---
## Overview
Marks an order as completed




## POST `(/orders/{orderId}/complete)`




### Request Body
<SchemaViewer file="request-body.json" maxHeight="500" id="request-body" />


### Responses

#### <span className="text-green-500">200 OK</span>
<SchemaViewer file="response-200.json" maxHeight="500" id="response-200" />



## Architecture

<NodeGraph />
