import pytest
from aws_lambda_powertools.utilities.parser import ValidationError

from activity_service.models.input import CreateActivityRequest


def test_create_activity_request_valid():
    # Given: Valid create activity request data
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    activity_time = 1640995200

    # When: CreateActivityRequest is initialized
    request = CreateActivityRequest(
        entityId=entity_id,
        entityType=entity_type,
        activityType=activity_type,
        activityTime=activity_time
    )

    # Then: No exception should be raised and values should be set correctly
    assert request.entityId == entity_id
    assert request.entityType == entity_type
    assert request.activityType == activity_type
    assert request.activityTime == activity_time


def test_create_activity_request_empty_entity_id():
    # Given: Empty entity_id
    entity_id = ''
    entity_type = 'product'
    activity_type = 'product_created'
    activity_time = 1640995200

    # When & Then: CreateActivityRequest is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        CreateActivityRequest(
            entityId=entity_id,
            entityType=entity_type,
            activityType=activity_type,
            activityTime=activity_time
        )


def test_create_activity_request_empty_entity_type():
    # Given: Empty entity_type
    entity_id = 'product-123'
    entity_type = ''
    activity_type = 'product_created'
    activity_time = 1640995200

    # When & Then: CreateActivityRequest is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        CreateActivityRequest(
            entityId=entity_id,
            entityType=entity_type,
            activityType=activity_type,
            activityTime=activity_time
        )


def test_create_activity_request_empty_activity_type():
    # Given: Empty activity_type
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = ''
    activity_time = 1640995200

    # When & Then: CreateActivityRequest is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        CreateActivityRequest(
            entityId=entity_id,
            entityType=entity_type,
            activityType=activity_type,
            activityTime=activity_time
        )


def test_create_activity_request_missing_entity_id():
    # Given: Missing entity_id
    entity_type = 'product'
    activity_type = 'product_created'
    activity_time = 1640995200

    # When & Then: CreateActivityRequest is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        CreateActivityRequest(
            entityType=entity_type,
            activityType=activity_type,
            activityTime=activity_time
        )


def test_create_activity_request_missing_entity_type():
    # Given: Missing entity_type
    entity_id = 'product-123'
    activity_type = 'product_created'
    activity_time = 1640995200

    # When & Then: CreateActivityRequest is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        CreateActivityRequest(
            entityId=entity_id,
            activityType=activity_type,
            activityTime=activity_time
        )


def test_create_activity_request_missing_activity_type():
    # Given: Missing activity_type
    entity_id = 'product-123'
    entity_type = 'product'
    activity_time = 1640995200

    # When & Then: CreateActivityRequest is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        CreateActivityRequest(
            entityId=entity_id,
            entityType=entity_type,
            activityTime=activity_time
        )


def test_create_activity_request_missing_activity_time():
    # Given: Missing activity_time
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'

    # When & Then: CreateActivityRequest is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        CreateActivityRequest(
            entityId=entity_id,
            entityType=entity_type,
            activityType=activity_type
        )


def test_create_activity_request_invalid_activity_time_type():
    # Given: Invalid activity_time type that cannot be converted to int
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    activity_time = 'not_a_number'

    # When & Then: CreateActivityRequest is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        CreateActivityRequest(
            entityId=entity_id,
            entityType=entity_type,
            activityType=activity_type,
            activityTime=activity_time
        )


def test_create_activity_request_negative_activity_time():
    # Given: Negative activity_time
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    activity_time = -1

    # When: CreateActivityRequest is initialized
    request = CreateActivityRequest(
        entityId=entity_id,
        entityType=entity_type,
        activityType=activity_type,
        activityTime=activity_time
    )

    # Then: No exception should be raised (negative timestamps can be valid)
    assert request.activityTime == activity_time
