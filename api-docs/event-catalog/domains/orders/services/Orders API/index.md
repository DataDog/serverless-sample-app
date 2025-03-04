---
id: Orders API
name: Order API
version: 1.0.0
summary: The order service API
badges: []
sends:
  - id: ordercreatedv1
    version: 1.0.0
  - id: orderconfirmedv1
    version: 1.0.0
  - id: ordercompletedv1
    version: 1.0.0
receives:
  - id: createorder
    version: 1.0.0
  - id: completeorder
    version: 1.0.0
  - id: getorderdetails
    version: 1.0.0
  - id: getuserorders
    version: 1.0.0
schemaPath: orders-api.yml
specifications:
  asyncapiPath: orders-api.yml
owners:
  - order-management
---
The order service API  

## Architecture diagram
<NodeGraph />
