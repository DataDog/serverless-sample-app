from __future__ import annotations

from unittest.mock import MagicMock, patch

from activity_service.dal.dynamo_dal_handler import DynamoDalHandler
from activity_service.models.activity import Activity, ActivityItem


def get_mock_activity(**overrides: object) -> Activity:
    """Factory for creating test Activity instances."""
    base_data: dict[str, object] = {
        "entity_id": "product-123",
        "entity_type": "product",
        "activities": [],
    }
    base_data.update(overrides)
    return Activity.model_validate(base_data)


def get_mock_activity_item(**overrides: object) -> ActivityItem:
    """Factory for creating test ActivityItem instances."""
    base_data: dict[str, object] = {
        "type": "product_created",
        "activity_time": 1640995200,
    }
    base_data.update(overrides)
    return ActivityItem.model_validate(base_data)


class TestUpdateActivityWritesOnlyNewItem:
    """Tests that update_activity performs only a single write for the new item."""

    def test_update_activity_with_single_new_item_makes_exactly_one_put_item_call(
        self,
    ) -> None:
        """Should make exactly one put_item call when adding a single new activity."""
        mock_table = MagicMock()
        handler = DynamoDalHandler.__new__(DynamoDalHandler)
        handler.table_name = "test-table"

        with patch.object(handler, "_get_db_handler", return_value=mock_table):
            activity = get_mock_activity(
                entity_id="product-123",
                entity_type="product",
                activities=[
                    get_mock_activity_item(
                        type="product_created", activity_time=1640995200
                    )
                ],
            )

            handler.update_activity(activity)

        assert mock_table.put_item.call_count == 1

    def test_update_activity_does_not_rewrite_historical_items(self) -> None:
        """Should not call put_item for historical items already in storage — only the new item."""
        mock_table = MagicMock()
        handler = DynamoDalHandler.__new__(DynamoDalHandler)
        handler.table_name = "test-table"

        with patch.object(handler, "_get_db_handler", return_value=mock_table):
            activity = get_mock_activity(
                entity_id="order-789",
                entity_type="order",
                activities=[
                    get_mock_activity_item(
                        type="order_created", activity_time=1640995100
                    ),
                    get_mock_activity_item(
                        type="order_confirmed", activity_time=1640995200
                    ),
                    get_mock_activity_item(
                        type="order_shipped", activity_time=1640995300
                    ),
                ],
            )

            handler.update_activity(activity)

        # Even with 3 activities in the activity object, only the NEW (last) item should be written
        assert mock_table.put_item.call_count == 1

    def test_update_activity_writes_only_the_last_activity_item(self) -> None:
        """Should write only the most recent activity item, not previously stored ones."""
        mock_table = MagicMock()
        handler = DynamoDalHandler.__new__(DynamoDalHandler)
        handler.table_name = "test-table"

        new_activity_item = get_mock_activity_item(
            type="order_delivered", activity_time=1640995600
        )

        with patch.object(handler, "_get_db_handler", return_value=mock_table):
            activity = get_mock_activity(
                entity_id="order-789",
                entity_type="order",
                activities=[
                    get_mock_activity_item(
                        type="order_created", activity_time=1640995100
                    ),
                    get_mock_activity_item(
                        type="order_confirmed", activity_time=1640995200
                    ),
                    new_activity_item,
                ],
            )

            handler.update_activity(activity)

        put_item_call = mock_table.put_item.call_args
        written_item = put_item_call[1]["Item"]
        assert written_item["activity_type"] == "order_delivered"
        assert written_item["created_at"] == 1640995600

    def test_update_activity_returns_the_activity_unchanged(self) -> None:
        """Should return the activity object passed in."""
        mock_table = MagicMock()
        handler = DynamoDalHandler.__new__(DynamoDalHandler)
        handler.table_name = "test-table"

        with patch.object(handler, "_get_db_handler", return_value=mock_table):
            activity = get_mock_activity(
                activities=[
                    get_mock_activity_item(
                        type="product_created", activity_time=1640995200
                    )
                ]
            )

            result = handler.update_activity(activity)

        assert result is activity

    def test_update_activity_writes_correct_partition_and_sort_keys(self) -> None:
        """Should write the new item with correct PK and SK format."""
        mock_table = MagicMock()
        handler = DynamoDalHandler.__new__(DynamoDalHandler)
        handler.table_name = "test-table"

        with patch.object(handler, "_get_db_handler", return_value=mock_table):
            activity = get_mock_activity(
                entity_id="product-123",
                entity_type="product",
                activities=[
                    get_mock_activity_item(
                        type="product_created", activity_time=1640995200
                    )
                ],
            )

            handler.update_activity(activity)

        put_item_call = mock_table.put_item.call_args
        written_item = put_item_call[1]["Item"]
        assert written_item["PK"] == "product-123-product"
        assert written_item["SK"] == "1640995200"


class TestDalHandlerSingletonBehavior:
    """Tests that DynamoDalHandler instances are correctly isolated by table name."""

    def test_different_table_names_produce_handlers_with_different_table_names(
        self,
    ) -> None:
        """Should be possible to create handlers for different table names, each retaining its own table name."""
        from activity_service.dal import get_dal_handler

        get_dal_handler.cache_clear()

        handler_a = get_dal_handler("table-alpha")
        handler_b = get_dal_handler("table-beta")

        assert handler_a.table_name == "table-alpha"
        assert handler_b.table_name == "table-beta"

        get_dal_handler.cache_clear()

    def test_same_table_name_returns_handler_with_correct_table_name(self) -> None:
        """Should return a handler whose table_name matches what was requested."""
        from activity_service.dal import get_dal_handler

        get_dal_handler.cache_clear()

        handler = get_dal_handler("my-activity-table")

        assert handler.table_name == "my-activity-table"

        get_dal_handler.cache_clear()

    def test_second_table_name_does_not_reuse_first_handler_table_name(
        self,
    ) -> None:
        """When requesting a handler for a second table, the returned handler must not carry the first table name."""
        from activity_service.dal import get_dal_handler

        get_dal_handler.cache_clear()

        get_dal_handler("first-table")
        handler_for_second = get_dal_handler("second-table")

        assert handler_for_second.table_name == "second-table"

        get_dal_handler.cache_clear()

    def test_same_table_name_is_cached_and_returns_same_instance(self) -> None:
        """Calling get_dal_handler with the same table name twice should return the same instance."""
        from activity_service.dal import get_dal_handler

        get_dal_handler.cache_clear()

        handler_one = get_dal_handler("cached-table")
        handler_two = get_dal_handler("cached-table")

        assert handler_one is handler_two

        get_dal_handler.cache_clear()
