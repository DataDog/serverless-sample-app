---
id: Orders API
version: 1.0.0
name: Order API
summary: ''
schemaPath: orders-api.yml
specifications:
  openapiPath: orders-api.yml
  asyncapiPath: orders-api-events.yml
badges: []
owners:
  - order-management
setMessageOwnersToServiceOwners: true
sends:
  - id: ordercreatedv1
    version: 1.0.0
  - id: ordercompletedv1
    version: 1.0.0
receives:
  - id: createOrder
    version: 1.0.0
  - id: getUserOrders
    version: 1.0.0
  - id: getOrderDetails
    version: 1.0.0
  - id: completeOrder
    version: 1.0.0
  - id: getConfirmedOrders
    version: 1.0.0
---
The order service API  

## Architecture diagram
<NodeGraph />
