---
id: User Management API
name: User Management API
version: 1.0.0
summary: The user management API
badges: []
sends:
  - id: userregisteredv1
    version: 1.0.0
receives:
  - id: login
    version: 1.0.0
  - id: register
    version: 1.0.0
schemaPath: user-mgmt-api-events.yml
specifications:
  openapiPath: user-mgmt-api.yml
  asyncapiPath: user-mgmt-api-events.yml
owners:
  - user-management
---
## Architecture diagram
<NodeGraph />
