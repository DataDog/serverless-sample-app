---
id: Product Management Service
name: Product ACL
version: 1.0.0
summary: The product service anti-corruption layer
badges: []
sends: []
receives:
  - id: inventorystockupdatedv1
    version: 1.0.0
  - id: ordercompletedv1
    version: 1.0.0
schemaPath: product-acl.yml
specifications:
  asyncapiPath: product-acl.yml
owners:
  - product-management
---
The product service anti-corruption layer  

## Architecture diagram
<NodeGraph />
