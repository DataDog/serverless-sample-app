import time

import pytest

from tests.utils import generate_random_string

from .test_api_driver import ApiDriver, initialize_api_driver


@pytest.fixture(scope='module', autouse=True)
def api_driver() -> ApiDriver:
    # Given: The API Gateway URL
    return initialize_api_driver()

def test_product_service_event_handling(api_driver):
    entity_id = generate_random_string()
    api_driver.inject_product_created_event(entity_id)
    time.sleep(1)
    api_driver.inject_product_updated_event(entity_id)
    time.sleep(1)
    api_driver.inject_product_deleted_event(entity_id)

    time.sleep(60)

    get_activity_response = api_driver.get_activity_for("product",entity_id)

    assert get_activity_response.get("entity_id") == entity_id
    assert len(get_activity_response.get("activities")) == 3

def test_order_service_event_handling(api_driver):
    entity_id = generate_random_string()
    api_driver.inject_order_created_event(entity_id)
    time.sleep(3)
    api_driver.inject_order_confirmed_event(entity_id)
    time.sleep(2)
    api_driver.inject_order_completed_event(entity_id)

    time.sleep(30)

    order_activity = api_driver.get_activity_for("order",entity_id)
    user_activity = api_driver.get_activity_for("user", entity_id)

    assert order_activity.get("entity_id") == entity_id
    assert len(order_activity.get("activities")) == 3

    assert user_activity.get("entity_id") == entity_id
    assert len(user_activity.get("activities")) == 3

def test_user_service_event_handling(api_driver):
    entity_id = generate_random_string()
    api_driver.inject_user_registered_event(entity_id)

    time.sleep(30)

    user_activity = api_driver.get_activity_for("user", entity_id)

    assert user_activity.get("entity_id") == entity_id
    assert len(user_activity.get("activities")) == 1

def test_inventory_service_stock_updated(api_driver):
    entity_id = generate_random_string()
    api_driver.inject_product_created_event(entity_id)
    time.sleep(2)
    api_driver.inject_stock_updated_event(entity_id)

    time.sleep(30)

    product_activity = api_driver.get_activity_for("product", entity_id)

    assert product_activity.get("entity_id") == entity_id
    assert len(product_activity.get("activities")) == 2

def test_inventory_service_stock_management_events(api_driver):
    entity_id = generate_random_string()
    api_driver.inject_order_created_event(entity_id)
    time.sleep(2)
    api_driver.inject_stock_reserved_event(entity_id)
    time.sleep(2)
    api_driver.inject_stock_reservation_failed_event(entity_id)

    time.sleep(30)

    product_activity = api_driver.get_activity_for("order", entity_id)

    assert product_activity.get("entity_id") == entity_id
    assert len(product_activity.get("activities")) == 3
