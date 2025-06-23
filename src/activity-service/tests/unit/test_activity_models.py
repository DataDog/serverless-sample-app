import pytest
from aws_lambda_powertools.utilities.parser import ValidationError

from activity_service.models.activity import Activity, ActivityItem


def test_activity_item_valid():
    # Given: Valid activity item data
    activity_type = 'product_created'
    activity_time = 1640995200

    # When: ActivityItem is initialized
    item = ActivityItem(type=activity_type, activity_time=activity_time)

    # Then: No exception should be raised and values should be set correctly
    assert item.type == activity_type
    assert item.activity_time == activity_time


def test_activity_item_empty_type():
    # Given: Empty activity type
    activity_type = ''
    activity_time = 1640995200

    # When & Then: ActivityItem is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItem(type=activity_type, activity_time=activity_time)


def test_activity_item_missing_type():
    # Given: Missing activity type
    activity_time = 1640995200

    # When & Then: ActivityItem is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItem(activity_time=activity_time)


def test_activity_item_invalid_time_type():
    # Given: Invalid activity time type that cannot be converted to int
    activity_type = 'product_created'
    activity_time = 'not_a_number'

    # When & Then: ActivityItem is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItem(type=activity_type, activity_time=activity_time)


def test_activity_item_missing_time():
    # Given: Missing activity time
    activity_type = 'product_created'

    # When & Then: ActivityItem is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItem(type=activity_type)


def test_activity_valid():
    # Given: Valid activity data
    entity_id = 'product-123'
    entity_type = 'product'
    activities = [
        ActivityItem(type='product_created', activity_time=1640995200),
        ActivityItem(type='product_updated', activity_time=1640995300)
    ]

    # When: Activity is initialized
    activity = Activity(entity_id=entity_id, entity_type=entity_type, activities=activities)

    # Then: No exception should be raised and values should be set correctly
    assert activity.entity_id == entity_id
    assert activity.entity_type == entity_type
    assert len(activity.activities) == 2
    assert activity.activities[0].type == 'product_created'
    assert activity.activities[1].type == 'product_updated'


def test_activity_empty_activities_list():
    # Given: Empty activities list
    entity_id = 'product-123'
    entity_type = 'product'
    activities = []

    # When: Activity is initialized
    activity = Activity(entity_id=entity_id, entity_type=entity_type, activities=activities)

    # Then: No exception should be raised
    assert activity.entity_id == entity_id
    assert activity.entity_type == entity_type
    assert len(activity.activities) == 0


def test_activity_empty_entity_id():
    # Given: Empty entity_id
    entity_id = ''
    entity_type = 'product'
    activities = []

    # When & Then: Activity is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        Activity(entity_id=entity_id, entity_type=entity_type, activities=activities)


def test_activity_empty_entity_type():
    # Given: Empty entity_type
    entity_id = 'product-123'
    entity_type = ''
    activities = []

    # When & Then: Activity is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        Activity(entity_id=entity_id, entity_type=entity_type, activities=activities)


def test_activity_missing_entity_id():
    # Given: Missing entity_id
    entity_type = 'product'
    activities = []

    # When & Then: Activity is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        Activity(entity_type=entity_type, activities=activities)


def test_activity_missing_entity_type():
    # Given: Missing entity_type
    entity_id = 'product-123'
    activities = []

    # When & Then: Activity is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        Activity(entity_id=entity_id, activities=activities)


def test_activity_missing_activities():
    # Given: Missing activities field
    entity_id = 'product-123'
    entity_type = 'product'

    # When & Then: Activity is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        Activity(entity_id=entity_id, entity_type=entity_type)


def test_activity_invalid_activities_type():
    # Given: Invalid activities type (not a list)
    entity_id = 'product-123'
    entity_type = 'product'
    activities = 'not_a_list'

    # When & Then: Activity is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        Activity(entity_id=entity_id, entity_type=entity_type, activities=activities)


def test_activity_invalid_activity_item_in_list():
    # Given: Invalid activity item in list
    entity_id = 'product-123'
    entity_type = 'product'
    activities = [
        ActivityItem(type='product_created', activity_time=1640995200),
        {'invalid': 'item'}  # Invalid item that should cause validation error
    ]

    # When & Then: Activity is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        Activity(entity_id=entity_id, entity_type=entity_type, activities=activities)
