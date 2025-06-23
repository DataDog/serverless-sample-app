import json
import os
import random
import time
from datetime import datetime
from typing import Any, Dict

import boto3
import requests


class ApiDriver:
    def __init__(self, api_endpoint: str, event_bus_name: str):
        self.api_endpoint = api_endpoint
        self.event_bridge_client = boto3.client('events')
        self.event_bus_name = event_bus_name
        self.environment = os.environ.get("ENV", "dev")

    def get_activity_for(self, entity_type: str, entity_id: str) -> Dict[str, Any]:
        api_endpoint = f"{self.api_endpoint}/api/activity/{entity_type}/{entity_id}"
        print(api_endpoint)

        response = requests.get(
            api_endpoint,
            # headers={
            #     "Authorization": f"Bearer {bearer_token}"
            # }
        )
        response.raise_for_status()
        return response.json()

    def inject_product_created_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("product", "product.productCreated.v1", {
            "productId": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.product",
            "DetailType": "product.productCreated.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_product_updated_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("product",  "product.productUpdated.v1", {
            "productId": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.product",
            "DetailType": "product.productUpdated.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_product_deleted_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("product", "product.productDeleted.v1", {
            "productId": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.product",
            "DetailType": "product.productDeleted.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_user_registered_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("users", "users.userCreated.v1", {
            "userId": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.users",
            "DetailType": "users.userCreated.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_order_created_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("orders", "orders.orderCreated.v1", {
            "orderNumber": entity_id,
            "userId": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.orders",
            "DetailType": "orders.orderCreated.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_order_confirmed_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("orders", "orders.orderConfirmed.v1", {
            "orderNumber": entity_id,
            "userId": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.orders",
            "DetailType": "orders.orderConfirmed.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_order_completed_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("orders", "orders.orderCompleted.v1", {
            "orderNumber": entity_id,
            "userId": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.orders",
            "DetailType": "orders.orderCompleted.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_stock_updated_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("inventory", "inventory.stockUpdated.v1", {
            "productId": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.inventory",
            "DetailType": "inventory.stockUpdated.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_stock_reserved_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("inventory", "inventory.stockReserved.v1", {
            "orderNumber": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.inventory",
            "DetailType": "inventory.stockReserved.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def inject_stock_reservation_failed_event(self, entity_id: str) -> None:
        event = self._wrap_with_cloud_events("inventory", "inventory.stockReservationFailed.v1", {
            "orderNumber": entity_id,
        })

        put_events_command = {
            "Source": f"{self.environment}.inventory",
            "DetailType": "inventory.stockReservationFailed.v1",
            "Detail": json.dumps(event),
            "EventBusName": self.event_bus_name
        }

        self.event_bridge_client.put_events(
            Entries=[put_events_command]
        )

    def _wrap_with_cloud_events(self, domain: str, event_type: str, data: Dict[str, str]) -> Dict[str, Any]:
        # Create unique ID
        id = f"{int(time.time() * 1000)}{random.randint(0, 1000000)}"

        return {
            "specversion": "1.0",
            "type": event_type,
            "source": f"{self.environment}.{domain}",
            "id": id,
            "time": datetime.now().isoformat(),
            "datacontenttype": "application/json",
            "data": data
        }


def initialize_api_driver():
    # Check if environment variables are set
    api_endpoint = os.environ.get("API_ENDPOINT")
    event_bus_name = os.environ.get("EVENT_BUS_NAME")

    global api_driver
    global jwt_secret_value

    if api_endpoint is not None and event_bus_name is not None:
        api_driver = ApiDriver(api_endpoint, event_bus_name)
        return api_driver

    # Get environment or default to "dev"
    env = os.environ.get("ENV", "dev")
    service_name = "ActivityService"
    shared_service_name = "shared" if env in ["dev", "prod"] else service_name

    # Initialize SSM client
    ssm_client = boto3.client('ssm')

    # Get API endpoint from SSM
    api_endpoint_parameter = ssm_client.get_parameter(
        Name=f"/{env}/{service_name}/api-endpoint"
    )

    # Get JWT secret from SSM
    jwt_secret_parameter = ssm_client.get_parameter(
        Name=f"/{env}/{shared_service_name}/secret-access-key"
    )
    jwt_secret_value = jwt_secret_parameter['Parameter']['Value']

    # Get event bus name from SSM
    event_bus_name_param = ssm_client.get_parameter(
        Name=f"/{env}/{shared_service_name}/event-bus-name"
    )
    event_bus_name = event_bus_name_param['Parameter']['Value']

    # Format API endpoint (remove trailing slash if present)
    api_endpoint = api_endpoint_parameter['Parameter']['Value']
    if api_endpoint.endswith("/"):
        api_endpoint = api_endpoint[:-1]

    api_driver = ApiDriver(api_endpoint, event_bus_name)
    return api_driver
