---
id: Inventory Service
name: Inventory Service
version: 1.0.0
summary: The inventory service
badges: []
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
schemaPath: inventory-service.yml
specifications:
  asyncapiPath: inventory-service.yml
owners:
  - inventory-service
---
The inventory service  

## Architecture diagram
<NodeGraph />
