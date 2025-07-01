import pytest
from aws_lambda_powertools.utilities.parser import ValidationError

from activity_service.dal.models.db import ActivityItemEntry


def test_activity_item_entry_valid():
    # Given: Valid activity item entry data
    pk = 'product-123-product'
    sk = '1640995200'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 1640995200

    # When: ActivityItemEntry is initialized
    entry = ActivityItemEntry(
        PK=pk,
        SK=sk,
        entity_id=entity_id,
        entity_type=entity_type,
        activity_type=activity_type,
        created_at=created_at
    )

    # Then: No exception should be raised and values should be set correctly
    assert entry.PK == pk
    assert entry.SK == sk
    assert entry.entity_id == entity_id
    assert entry.entity_type == entity_type
    assert entry.activity_type == activity_type
    assert entry.created_at == created_at


def test_activity_item_entry_empty_pk():
    # Given: Empty PK
    pk = ''
    sk = '1640995200'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_empty_sk():
    # Given: Empty SK
    pk = 'product-123-product'
    sk = ''
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_empty_entity_id():
    # Given: Empty entity_id
    pk = 'product-123-product'
    sk = '1640995200'
    entity_id = ''
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_empty_entity_type():
    # Given: Empty entity_type
    pk = 'product-123-product'
    sk = '1640995200'
    entity_id = 'product-123'
    entity_type = ''
    activity_type = 'product_created'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_empty_activity_type():
    # Given: Empty activity_type
    pk = 'product-123-product'
    sk = '1640995200'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = ''
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_missing_pk():
    # Given: Missing PK
    sk = '1640995200'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_missing_sk():
    # Given: Missing SK
    pk = 'product-123-product'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_missing_entity_id():
    # Given: Missing entity_id
    pk = 'product-123-product'
    sk = '1640995200'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_missing_entity_type():
    # Given: Missing entity_type
    pk = 'product-123-product'
    sk = '1640995200'
    entity_id = 'product-123'
    activity_type = 'product_created'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_missing_activity_type():
    # Given: Missing activity_type
    pk = 'product-123-product'
    sk = '1640995200'
    entity_id = 'product-123'
    entity_type = 'product'
    created_at = 1640995200

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            created_at=created_at
        )


def test_activity_item_entry_missing_created_at():
    # Given: Missing created_at
    pk = 'product-123-product'
    sk = '1640995200'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type
        )


def test_activity_item_entry_invalid_created_at_type():
    # Given: Invalid created_at type that cannot be converted to int
    pk = 'product-123-product'
    sk = '1640995200'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 'not_a_number'

    # When & Then: ActivityItemEntry is initialized, expect a ValidationError
    with pytest.raises(ValidationError):
        ActivityItemEntry(
            PK=pk,
            SK=sk,
            entity_id=entity_id,
            entity_type=entity_type,
            activity_type=activity_type,
            created_at=created_at
        )


def test_activity_item_entry_negative_created_at():
    # Given: Negative created_at timestamp
    pk = 'product-123-product'
    sk = '-1'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = -1

    # When: ActivityItemEntry is initialized
    entry = ActivityItemEntry(
        PK=pk,
        SK=sk,
        entity_id=entity_id,
        entity_type=entity_type,
        activity_type=activity_type,
        created_at=created_at
    )

    # Then: No exception should be raised (negative timestamps can be valid)
    assert entry.created_at == created_at


def test_activity_item_entry_zero_created_at():
    # Given: Zero created_at timestamp
    pk = 'product-123-product'
    sk = '0'
    entity_id = 'product-123'
    entity_type = 'product'
    activity_type = 'product_created'
    created_at = 0

    # When: ActivityItemEntry is initialized
    entry = ActivityItemEntry(
        PK=pk,
        SK=sk,
        entity_id=entity_id,
        entity_type=entity_type,
        activity_type=activity_type,
        created_at=created_at
    )

    # Then: No exception should be raised (zero timestamp can be valid)
    assert entry.created_at == created_at
