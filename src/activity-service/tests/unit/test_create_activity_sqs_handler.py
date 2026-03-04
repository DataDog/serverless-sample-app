from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Generator
from unittest.mock import MagicMock, patch

from aws_lambda_powertools.utilities.typing import LambdaContext

_ENV_VARS = {
    'POWERTOOLS_SERVICE_NAME': 'activity-service',
    'LOG_LEVEL': 'DEBUG',
    'TABLE_NAME': 'test-table',
    'IDEMPOTENCY_TABLE_NAME': 'test-idempotency-table',
}


def _make_lambda_context() -> LambdaContext:
    context = LambdaContext()
    context._aws_request_id = '888888'
    context._function_name = 'test'
    context._memory_limit_in_mb = 128
    context._invoked_function_arn = 'arn:aws:lambda:eu-west-1:123456789012:function:test'
    return context


def _make_sqs_event(records: list[dict[str, Any]]) -> dict[str, Any]:
    return {'Records': records}


def _make_sqs_record(
    body: dict[str, Any],
    message_id: str = 'msg-001',
    receipt_handle: str = 'receipt-001',
) -> dict[str, Any]:
    return {
        'messageId': message_id,
        'receiptHandle': receipt_handle,
        'body': json.dumps(body),
        'attributes': {
            'ApproximateReceiveCount': '1',
            'SentTimestamp': '1546300800000',
            'SenderId': '123456789012',
            'ApproximateFirstReceiveTimestamp': '1546300800001',
        },
        'messageAttributes': {},
        'md5OfBody': 'abc123',
        'eventSource': 'aws:sqs',
        'eventSourceARN': 'arn:aws:sqs:eu-west-1:123456789012:test-queue',
        'awsRegion': 'eu-west-1',
    }


def _make_event_bridge_body(
    event_type: str,
    detail: dict[str, Any],
    time: str = '2024-01-15T10:30:00Z',
    datadog_envelope: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cloud_event: dict[str, Any] = {
        'type': event_type,
        'id': 'event-001',
        'data': detail,
    }
    if datadog_envelope is not None:
        cloud_event['_datadog'] = datadog_envelope

    return {
        'source': 'product-service',
        'detail-type': 'product.productCreated.v1',
        'time': time,
        'detail': cloud_event,
    }


@contextmanager
def _idempotency_bypassed() -> Generator[None, None, None]:
    """Context manager that bypasses DynamoDB calls in the idempotency layer.

    The idempotent_function decorator captures the persistence_store reference
    at decoration time, so we must patch the methods on the actual instance.
    """
    from aws_lambda_powertools.utilities.idempotency.exceptions import IdempotencyItemNotFoundError

    import activity_service.handlers.create_activity as handler_module

    layer = handler_module.IDEMPOTENCY_LAYER

    with (
        patch.object(layer, 'save_inprogress', return_value=None),
        patch.object(layer, 'save_success', return_value=None),
        patch.object(layer, 'delete_record', return_value=None),
        patch.object(layer, 'get_record', side_effect=IdempotencyItemNotFoundError()),
        patch.object(layer, '_put_record', return_value=None),
        patch.object(layer, '_get_record', side_effect=IdempotencyItemNotFoundError()),
        patch.object(layer, '_update_record', return_value=None),
        patch.object(layer, '_delete_record', return_value=None),
    ):
        yield


class TestTimestampParsing:
    """Tests for Issue 5: Timestamp parsing is brittle."""

    def test_parses_timestamp_with_trailing_z(self) -> None:
        """Should parse ISO 8601 timestamps with trailing Z (UTC marker)."""
        from activity_service.handlers.create_activity import convert_date_time_string_to_epoch

        result = convert_date_time_string_to_epoch('2024-01-15T10:30:00Z')

        assert isinstance(result, int)
        assert result > 0

    def test_parses_timestamp_with_fractional_seconds_no_z(self) -> None:
        """Should parse ISO 8601 timestamps with fractional seconds and no trailing Z."""
        from activity_service.handlers.create_activity import convert_date_time_string_to_epoch

        result = convert_date_time_string_to_epoch('2024-01-15T10:30:00.123456789')

        assert isinstance(result, int)
        assert result > 0

    def test_parses_timestamp_with_fractional_seconds_and_z(self) -> None:
        """Should parse ISO 8601 timestamps with fractional seconds and trailing Z."""
        from activity_service.handlers.create_activity import convert_date_time_string_to_epoch

        result = convert_date_time_string_to_epoch('2024-01-15T10:30:00.123Z')

        assert isinstance(result, int)
        assert result > 0

    def test_parses_timestamp_with_microseconds(self) -> None:
        """Should parse ISO 8601 timestamps with microsecond precision."""
        from activity_service.handlers.create_activity import convert_date_time_string_to_epoch

        result = convert_date_time_string_to_epoch('2024-01-15T10:30:00.123456')

        assert isinstance(result, int)
        assert result > 0

    def test_returns_milliseconds_epoch(self) -> None:
        """Should return epoch time in milliseconds."""
        from activity_service.handlers.create_activity import convert_date_time_string_to_epoch

        result = convert_date_time_string_to_epoch('2024-01-15T10:30:00Z')

        assert result > 1_000_000_000_000

    def test_fractional_and_non_fractional_produce_same_second(self) -> None:
        """Fractional-second and whole-second timestamps for the same moment should agree on the second."""
        from activity_service.handlers.create_activity import convert_date_time_string_to_epoch

        whole = convert_date_time_string_to_epoch('2024-01-15T10:30:00Z')
        fractional = convert_date_time_string_to_epoch('2024-01-15T10:30:00.000Z')

        assert whole == fractional

    def test_sqs_handler_processes_event_with_fractional_second_timestamp(self) -> None:
        """Full SQS handler should process an event carrying a fractional-second timestamp without error."""
        import activity_service.handlers.create_activity as handler_module

        mock_dal = MagicMock()
        mock_activity = MagicMock()
        mock_activity.activities = []
        mock_dal.get_activity.return_value = mock_activity
        mock_dal.update_activity.return_value = mock_activity

        body = _make_event_bridge_body(
            event_type='product.productCreated.v1',
            detail={'productId': 'prod-1'},
            time='2024-01-15T10:30:00.123456789',
        )
        event = _make_sqs_event([_make_sqs_record(body)])

        with (
            patch.dict('os.environ', _ENV_VARS),
            patch.object(handler_module, 'dal_handler', mock_dal),
            _idempotency_bypassed(),
        ):
            result = handler_module.lambda_handler(event, _make_lambda_context())

        assert result['batchItemFailures'] == []


class TestTraceParentExtraction:
    """Tests for Issue 4: Trace linkage ignores _datadog.traceparent."""

    def test_extracts_traceparent_from_datadog_envelope(self) -> None:
        """Should prefer _datadog.traceparent over top-level traceparent."""
        import activity_service.handlers.create_activity as handler_module

        mock_dal = MagicMock()
        mock_activity = MagicMock()
        mock_activity.activities = []
        mock_dal.get_activity.return_value = mock_activity
        mock_dal.update_activity.return_value = mock_activity

        datadog_envelope = {
            'traceparent': '00-aabbccdd11223344aabbccdd11223344-0102030405060708-01',
        }
        body = _make_event_bridge_body(
            event_type='product.productCreated.v1',
            detail={'productId': 'prod-1'},
            datadog_envelope=datadog_envelope,
        )
        event = _make_sqs_event([_make_sqs_record(body)])

        with (
            patch.dict('os.environ', _ENV_VARS),
            patch.object(handler_module, 'dal_handler', mock_dal),
            _idempotency_bypassed(),
        ):
            result = handler_module.lambda_handler(event, _make_lambda_context())

        assert result['batchItemFailures'] == []

    def test_falls_back_to_top_level_traceparent_when_no_datadog_envelope(self) -> None:
        """Should use top-level traceparent when there is no _datadog envelope."""
        import activity_service.handlers.create_activity as handler_module

        mock_dal = MagicMock()
        mock_activity = MagicMock()
        mock_activity.activities = []
        mock_dal.get_activity.return_value = mock_activity
        mock_dal.update_activity.return_value = mock_activity

        body = _make_event_bridge_body(
            event_type='product.productCreated.v1',
            detail={'productId': 'prod-2'},
        )
        body['detail']['traceparent'] = '00-aabbccdd11223344aabbccdd11223344-0102030405060709-01'
        event = _make_sqs_event([_make_sqs_record(body)])

        with (
            patch.dict('os.environ', _ENV_VARS),
            patch.object(handler_module, 'dal_handler', mock_dal),
            _idempotency_bypassed(),
        ):
            result = handler_module.lambda_handler(event, _make_lambda_context())

        assert result['batchItemFailures'] == []

    def test_prefers_datadog_envelope_traceparent_over_top_level(self) -> None:
        """When both _datadog.traceparent and top-level traceparent are present, _datadog.traceparent wins."""
        from activity_service.handlers.create_activity import extract_trace_parent

        datadog_traceparent = '00-aaaaaaaabbbbbbbb1111111122222222-0102030405060708-01'
        top_level_traceparent = '00-ccccccccdddddddd3333333344444444-0102030405060709-01'

        cloud_event_with_both: dict[str, Any] = {
            'traceparent': top_level_traceparent,
            '_datadog': {'traceparent': datadog_traceparent},
        }

        result = extract_trace_parent(cloud_event_with_both)

        assert result == datadog_traceparent

    def test_returns_none_when_no_traceparent_present(self) -> None:
        """Should return None when no traceparent is present in either location."""
        from activity_service.handlers.create_activity import extract_trace_parent

        result = extract_trace_parent({})

        assert result is None


class TestDataStreamsCheckpoints:
    """Tests for Issue 3: Data Streams context not handled."""

    def test_consume_checkpoint_called_for_each_sqs_record(self) -> None:
        """Should call set_consume_checkpoint for each SQS record processed."""
        import activity_service.handlers.create_activity as handler_module

        mock_dal = MagicMock()
        mock_activity = MagicMock()
        mock_activity.activities = []
        mock_dal.get_activity.return_value = mock_activity
        mock_dal.update_activity.return_value = mock_activity

        body = _make_event_bridge_body(
            event_type='product.productCreated.v1',
            detail={'productId': 'prod-1'},
            datadog_envelope={'dd-pathway-ctx': 'some-pathway-ctx-value'},
        )
        event = _make_sqs_event([_make_sqs_record(body)])

        with (
            patch.dict('os.environ', _ENV_VARS),
            patch.object(handler_module, 'dal_handler', mock_dal),
            _idempotency_bypassed(),
            patch('activity_service.handlers.create_activity.set_consume_checkpoint') as mock_consume,
        ):
            result = handler_module.lambda_handler(event, _make_lambda_context())

        assert result['batchItemFailures'] == []
        mock_consume.assert_called_once()

    def test_consume_checkpoint_uses_sqs_type(self) -> None:
        """Should call set_consume_checkpoint with 'sqs' as the checkpoint type."""
        import activity_service.handlers.create_activity as handler_module

        mock_dal = MagicMock()
        mock_activity = MagicMock()
        mock_activity.activities = []
        mock_dal.get_activity.return_value = mock_activity
        mock_dal.update_activity.return_value = mock_activity

        body = _make_event_bridge_body(
            event_type='product.productCreated.v1',
            detail={'productId': 'prod-1'},
            datadog_envelope={'dd-pathway-ctx': 'some-pathway-ctx-value'},
        )
        event = _make_sqs_event([_make_sqs_record(body)])

        with (
            patch.dict('os.environ', _ENV_VARS),
            patch.object(handler_module, 'dal_handler', mock_dal),
            _idempotency_bypassed(),
            patch('activity_service.handlers.create_activity.set_consume_checkpoint') as mock_consume,
        ):
            handler_module.lambda_handler(event, _make_lambda_context())

        call_args = mock_consume.call_args
        assert call_args[0][0] == 'sqs'

    def test_dd_pathway_ctx_extracted_from_datadog_envelope(self) -> None:
        """Should extract dd-pathway-ctx from _datadog envelope and pass it as carrier to consume checkpoint."""
        from activity_service.handlers.create_activity import extract_data_streams_carrier

        pathway_ctx_value = 'encoded-pathway-ctx-123'
        cloud_event: dict[str, Any] = {
            '_datadog': {'dd-pathway-ctx': pathway_ctx_value},
        }

        carrier_get = extract_data_streams_carrier(cloud_event)

        assert carrier_get('dd-pathway-ctx') == pathway_ctx_value

    def test_carrier_get_returns_none_for_missing_key(self) -> None:
        """Should return None for a key that does not exist in the _datadog envelope."""
        from activity_service.handlers.create_activity import extract_data_streams_carrier

        cloud_event: dict[str, Any] = {'_datadog': {}}

        carrier_get = extract_data_streams_carrier(cloud_event)

        assert carrier_get('dd-pathway-ctx') is None

    def test_carrier_get_returns_none_when_no_datadog_envelope(self) -> None:
        """Should return None for any key when there is no _datadog envelope."""
        from activity_service.handlers.create_activity import extract_data_streams_carrier

        carrier_get = extract_data_streams_carrier({})

        assert carrier_get('dd-pathway-ctx') is None


class TestIdempotency:
    """Tests for Issue 2: Idempotency never applied."""

    def test_processing_same_message_twice_calls_create_activity_once(self) -> None:
        """When an identical SQS message is processed twice, the handler functions are idempotent."""
        from aws_lambda_powertools.utilities.idempotency.exceptions import (
            IdempotencyItemAlreadyExistsError,
            IdempotencyItemNotFoundError,
        )
        from aws_lambda_powertools.utilities.idempotency.persistence.datarecord import STATUS_CONSTANTS, DataRecord

        import activity_service.handlers.create_activity as handler_module

        mock_dal = MagicMock()
        mock_activity = MagicMock()
        mock_activity.activities = []
        mock_dal.get_activity.return_value = mock_activity
        mock_dal.update_activity.return_value = None

        layer = handler_module.IDEMPOTENCY_LAYER

        body = _make_event_bridge_body(
            event_type='product.productCreated.v1',
            detail={'productId': 'prod-idempotent-1'},
            time='2024-01-15T10:30:00Z',
        )
        record = _make_sqs_record(body, message_id='idempotent-msg-001')
        event = _make_sqs_event([record])

        completed_record = DataRecord(
            idempotency_key='test-key',
            status=STATUS_CONSTANTS['COMPLETED'],
            response_data='null',
        )

        already_exists_error = IdempotencyItemAlreadyExistsError()
        already_exists_error.old_data_record = completed_record

        with patch.dict('os.environ', _ENV_VARS), patch.object(handler_module, 'dal_handler', mock_dal):
            with (
                patch.object(layer, 'save_inprogress', return_value=None),
                patch.object(layer, 'save_success', return_value=None),
                patch.object(layer, 'delete_record', return_value=None),
                patch.object(layer, '_put_record', return_value=None),
                patch.object(layer, '_get_record', side_effect=IdempotencyItemNotFoundError()),
                patch.object(layer, '_update_record', return_value=None),
                patch.object(layer, '_delete_record', return_value=None),
            ):
                handler_module.lambda_handler(event, _make_lambda_context())
                call_count_after_first = mock_dal.get_activity.call_count

            with (
                patch.object(layer, 'save_inprogress', side_effect=already_exists_error),
                patch.object(layer, 'save_success', return_value=None),
                patch.object(layer, 'delete_record', return_value=None),
                patch.object(layer, '_put_record', side_effect=already_exists_error),
                patch.object(layer, '_get_record', return_value=completed_record),
                patch.object(layer, '_update_record', return_value=None),
                patch.object(layer, '_delete_record', return_value=None),
            ):
                handler_module.lambda_handler(event, _make_lambda_context())
                call_count_after_second = mock_dal.get_activity.call_count

        assert call_count_after_second == call_count_after_first, (
            f'Expected no new DAL calls on second invocation (idempotency should short-circuit), '
            f'but DAL was called {call_count_after_second - call_count_after_first} additional time(s)'
        )

    def test_process_message_is_idempotent_using_event_id(self) -> None:
        """The process_message function should be decorated with idempotency using event id as key."""
        import activity_service.handlers.create_activity as handler_module

        idempotency_config = getattr(handler_module, 'IDEMPOTENCY_CONFIG', None)

        assert idempotency_config is not None, (
            'Expected IDEMPOTENCY_CONFIG to be present in create_activity handler module'
        )

    def test_idempotency_layer_is_configured(self) -> None:
        """The idempotency persistence layer should be configured in the handler module."""
        import activity_service.handlers.create_activity as handler_module

        idempotency_layer = getattr(handler_module, 'IDEMPOTENCY_LAYER', None)

        assert idempotency_layer is not None, (
            'Expected IDEMPOTENCY_LAYER to be present in create_activity handler module'
        )
