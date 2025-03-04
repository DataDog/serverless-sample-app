---
id: Orders ACL
name: Order ACL
version: 1.0.0
summary: The order service anti-corruption layer
badges: []
sends: []
receives:
  - id: stockreservationsuccessv1
    version: 1.0.0
  - id: stockreservationfailedv1
    version: 1.0.0
  - id: confirmorder
    version: 1.0.0
  - id: inventorystockreservedv1
    version: 1.0.0
  - id: inventorystockreservationfailedv1
    version: 1.0.0
schemaPath: orders-acl.yml
specifications:
  asyncapiPath: orders-acl.yml
owners:
  - order-management
---
The order service anti-corruption layer  

## Architecture diagram
<NodeGraph />
