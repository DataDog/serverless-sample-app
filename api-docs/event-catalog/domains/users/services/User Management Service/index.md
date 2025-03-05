---
id: User Management Service
name: User Management ACL
version: 1.0.0
summary: The user management service anti-corruption layer
badges: []
sends: []
receives:
  - id: ordercreatedv1
    version: 1.0.0
  - id: orderconfirmedv1
    version: 1.0.0
  - id: ordercompletedv1
    version: 1.0.0
schemaPath: user-mgmt-acl.yml
specifications:
  asyncapiPath: user-mgmt-acl.yml
owners:
  - user-management
---
The user management service anti-corruption layer  

## Architecture diagram
<NodeGraph />
