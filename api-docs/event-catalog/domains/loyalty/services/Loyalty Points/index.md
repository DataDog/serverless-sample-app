---
id: Loyalty Points
name: Loyalty Service
version: 1.0.0
summary: The loyalty service
badges: []
sends:
  - id: loyaltypointsaddedv1
    version: 1.0.0
receives:
  - id: ordercompletedv1
    version: 1.0.0
  - id: userregisteredv1
    version: 1.0.0
  - id: getPoints
    version: 1.0.0
  - id: spendPoints
    version: 1.0.0
schemaPath: loyalty-service.yml
specifications:
  openapiPath: loyalty-api.yml
  asyncapiPath: loyalty-service.yml
owners:
  - loyalty-points
---
The loyalty service  

## Architecture diagram
<NodeGraph />
