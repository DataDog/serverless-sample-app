---
id: Inventory Service
version: 1.0.0
name: Inventory Service
summary: ''
schemaPath: inventory-api.yml
specifications:
  openapiPath: inventory-api.yml
  asyncapiPath: inventory-service.yml
badges: []
owners:
  - inventory-service
setMessageOwnersToServiceOwners: true
sends:
  - id: inventorystockreservedv1
    version: 1.0.0
  - id: inventorystockreservationfailedv1
    version: 1.0.0
  - id: inventorystockupdatedv1
    version: 1.0.0
  - id: productoutofstockv1
    version: 1.0.0
receives:
  - id: ordercreatedv1
    version: 1.0.0
  - id: productcreatedv1
    version: 1.0.0
  - id: productupdatedv1
    version: 1.0.0
  - id: productdeletedv1
    version: 1.0.0
  - id: updateInventory
    version: 1.0.0
  - id: getStockByProductId
    version: 1.0.0
  - id: ordercompletedv1
    version: 1.0.0
---
The inventory service  

## Architecture diagram
<NodeGraph />
