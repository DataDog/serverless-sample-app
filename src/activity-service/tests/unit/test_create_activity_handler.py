from unittest.mock import Mock

from activity_service.dal.db_handler import DalHandler
from activity_service.logic.create_activity_handler import create_activity_handler
from activity_service.models.activity import Activity, ActivityItem
from activity_service.models.input import CreateActivityRequest


def test_create_activity_handler_success_with_existing_activities():
    # Given: A mock DAL handler with existing activities
    mock_dal_handler = Mock(spec=DalHandler)
    existing_activities = [
        ActivityItem(type='product_created', activity_time=1640995200),
        ActivityItem(type='product_updated', activity_time=1640995300)
    ]
    existing_activity = Activity(
        entity_id='product-123',
        entity_type='product',
        activities=existing_activities
    )
    mock_dal_handler.get_activity.return_value = existing_activity
    mock_dal_handler.update_activity.return_value = existing_activity

    # And: A valid create activity request
    request = CreateActivityRequest(
        entityId='product-123',
        entityType='product',
        activityType='product_price_changed',
        activityTime=1640995400
    )

    # When: create_activity_handler is called
    result = create_activity_handler(request, mock_dal_handler)

    # Then: The DAL handler should be called correctly
    mock_dal_handler.get_activity.assert_called_once_with('product-123', 'product')
    mock_dal_handler.update_activity.assert_called_once()

    # And: The returned activity should have the new activity added
    updated_activity = mock_dal_handler.update_activity.call_args[0][0]
    assert len(updated_activity.activities) == 3
    assert updated_activity.activities[-1].type == 'product_price_changed'
    assert updated_activity.activities[-1].activity_time == 1640995400

    # And: The result should indicate success
    assert result['status'] == 'success'
    assert 'product_price_changed' in result['message']
    assert 'product-123' in result['message']


def test_create_activity_handler_success_with_empty_activities():
    # Given: A mock DAL handler with no existing activities
    mock_dal_handler = Mock(spec=DalHandler)
    existing_activity = Activity(
        entity_id='customer-456',
        entity_type='customer',
        activities=[]
    )
    mock_dal_handler.get_activity.return_value = existing_activity
    mock_dal_handler.update_activity.return_value = existing_activity

    # And: A valid create activity request
    request = CreateActivityRequest(
        entityId='customer-456',
        entityType='customer',
        activityType='customer_registered',
        activityTime=1640995500
    )

    # When: create_activity_handler is called
    result = create_activity_handler(request, mock_dal_handler)

    # Then: The DAL handler should be called correctly
    mock_dal_handler.get_activity.assert_called_once_with('customer-456', 'customer')
    mock_dal_handler.update_activity.assert_called_once()

    # And: The returned activity should have one activity
    updated_activity = mock_dal_handler.update_activity.call_args[0][0]
    assert len(updated_activity.activities) == 1
    assert updated_activity.activities[0].type == 'customer_registered'
    assert updated_activity.activities[0].activity_time == 1640995500

    # And: The result should indicate success
    assert result['status'] == 'success'
    assert 'customer_registered' in result['message']
    assert 'customer-456' in result['message']


def test_create_activity_handler_preserves_existing_activities():
    # Given: A mock DAL handler with multiple existing activities
    mock_dal_handler = Mock(spec=DalHandler)
    existing_activities = [
        ActivityItem(type='order_created', activity_time=1640995100),
        ActivityItem(type='order_confirmed', activity_time=1640995200),
        ActivityItem(type='order_shipped', activity_time=1640995300)
    ]
    existing_activity = Activity(
        entity_id='order-789',
        entity_type='order',
        activities=existing_activities
    )
    mock_dal_handler.get_activity.return_value = existing_activity
    mock_dal_handler.update_activity.return_value = existing_activity

    # And: A valid create activity request
    request = CreateActivityRequest(
        entityId='order-789',
        entityType='order',
        activityType='order_delivered',
        activityTime=1640995600
    )

    # When: create_activity_handler is called
    create_activity_handler(request, mock_dal_handler)

    # Then: All original activities should be preserved
    updated_activity = mock_dal_handler.update_activity.call_args[0][0]
    assert len(updated_activity.activities) == 4

    # Original activities should remain unchanged
    assert updated_activity.activities[0].type == 'order_created'
    assert updated_activity.activities[0].activity_time == 1640995100
    assert updated_activity.activities[1].type == 'order_confirmed'
    assert updated_activity.activities[1].activity_time == 1640995200
    assert updated_activity.activities[2].type == 'order_shipped'
    assert updated_activity.activities[2].activity_time == 1640995300

    # New activity should be added at the end
    assert updated_activity.activities[3].type == 'order_delivered'
    assert updated_activity.activities[3].activity_time == 1640995600


def test_create_activity_handler_with_different_entity_types():
    # Given: A mock DAL handler
    mock_dal_handler = Mock(spec=DalHandler)
    existing_activity = Activity(
        entity_id='payment-999',
        entity_type='payment',
        activities=[]
    )
    mock_dal_handler.get_activity.return_value = existing_activity
    mock_dal_handler.update_activity.return_value = existing_activity

    # And: A valid create activity request for a payment entity
    request = CreateActivityRequest(
        entityId='payment-999',
        entityType='payment',
        activityType='payment_processed',
        activityTime=1640995700
    )

    # When: create_activity_handler is called
    result = create_activity_handler(request, mock_dal_handler)

    # Then: The DAL handler should be called with correct entity type
    mock_dal_handler.get_activity.assert_called_once_with('payment-999', 'payment')

    # And: The result should reflect the correct entity and activity types
    assert result['status'] == 'success'
    assert 'payment_processed' in result['message']
    assert 'payment-999' in result['message']


def test_create_activity_handler_activity_item_creation():
    # Given: A mock DAL handler
    mock_dal_handler = Mock(spec=DalHandler)
    existing_activity = Activity(
        entity_id='test-entity',
        entity_type='test',
        activities=[]
    )
    mock_dal_handler.get_activity.return_value = existing_activity
    mock_dal_handler.update_activity.return_value = existing_activity

    # And: A valid create activity request
    request = CreateActivityRequest(
        entityId='test-entity',
        entityType='test',
        activityType='test_activity',
        activityTime=1234567890
    )

    # When: create_activity_handler is called
    create_activity_handler(request, mock_dal_handler)

    # Then: The created ActivityItem should have correct properties
    updated_activity = mock_dal_handler.update_activity.call_args[0][0]
    created_item = updated_activity.activities[0]

    assert isinstance(created_item, ActivityItem)
    assert created_item.type == 'test_activity'
    assert created_item.activity_time == 1234567890


def test_create_activity_handler_return_format():
    # Given: A mock DAL handler
    mock_dal_handler = Mock(spec=DalHandler)
    existing_activity = Activity(
        entity_id='format-test',
        entity_type='test',
        activities=[]
    )
    mock_dal_handler.get_activity.return_value = existing_activity
    mock_dal_handler.update_activity.return_value = existing_activity

    # And: A valid create activity request
    request = CreateActivityRequest(
        entityId='format-test',
        entityType='test',
        activityType='format_activity',
        activityTime=1640995800
    )

    # When: create_activity_handler is called
    result = create_activity_handler(request, mock_dal_handler)

    # Then: The result should have the expected format
    assert isinstance(result, dict)
    assert 'status' in result
    assert 'message' in result
    assert result['status'] == 'success'
    assert isinstance(result['message'], str)
    assert len(result['message']) > 0
