from __future__ import annotations

import os

# Set required environment variables before any test modules are imported.
# activity_service.handlers.utils.idempotency reads IDEMPOTENCY_TABLE_NAME at
# module import time (via get_environment_variables), so the value must be
# present in os.environ during pytest collection, before any test body runs.
os.environ.setdefault('IDEMPOTENCY_TABLE_NAME', 'test-idempotency-table')
os.environ.setdefault('TABLE_NAME', 'test-table')
os.environ.setdefault('POWERTOOLS_SERVICE_NAME', 'activity-service')
os.environ.setdefault('LOG_LEVEL', 'DEBUG')
