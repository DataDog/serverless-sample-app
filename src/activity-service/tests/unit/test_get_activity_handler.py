from __future__ import annotations

import json
from http import HTTPStatus
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from aws_lambda_powertools.utilities.typing import LambdaContext

from activity_service.models.activity import Activity, ActivityItem


def _make_api_gw_event(entity_type: str, entity_id: str) -> dict[str, Any]:
    return {
        'version': '1.0',
        'resource': f'/api/activity/{entity_type}/{entity_id}',
        'path': f'/api/activity/{entity_type}/{entity_id}',
        'httpMethod': 'GET',
        'headers': {'Content-Type': 'application/json'},
        'multiValueHeaders': {},
        'queryStringParameters': None,
        'multiValueQueryStringParameters': None,
        'requestContext': {
            'accountId': '123456789012',
            'apiId': 'id',
            'authorizer': {'claims': None, 'scopes': None},
            'domainName': 'id.execute-api.us-east-1.amazonaws.com',
            'domainPrefix': 'id',
            'extendedRequestId': 'request-id',
            'httpMethod': 'GET',
            'identity': {
                'accessKey': None,
                'accountId': None,
                'caller': None,
                'cognitoAuthenticationProvider': None,
                'cognitoAuthenticationType': None,
                'cognitoIdentityId': None,
                'cognitoIdentityPoolId': None,
                'principalOrgId': None,
                'sourceIp': '192.168.0.1/32',
                'user': None,
                'userAgent': 'user-agent',
                'userArn': None,
            },
            'path': f'/api/activity/{entity_type}/{entity_id}',
            'protocol': 'HTTP/1.1',
            'requestId': 'id=',
            'requestTime': '04/Mar/2020:19:15:17 +0000',
            'requestTimeEpoch': 1583349317135,
            'resourceId': None,
            'resourcePath': f'/api/activity/{entity_type}/{entity_id}',
            'stage': '$default',
        },
        'pathParameters': {
            'entity_type': entity_type,
            'entity_id': entity_id,
        },
        'stageVariables': None,
        'body': None,
        'isBase64Encoded': False,
    }


def _make_lambda_context() -> LambdaContext:
    context = LambdaContext()
    context._aws_request_id = '888888'
    context._function_name = 'test'
    context._memory_limit_in_mb = 128
    context._invoked_function_arn = 'arn:aws:lambda:eu-west-1:123456789012:function:test'
    return context


_ENV_VARS = {
    'POWERTOOLS_SERVICE_NAME': 'activity-service',
    'POWERTOOLS_LOG_LEVEL': 'DEBUG',
    'TABLE_NAME': 'test-table',
    'IDEMPOTENCY_TABLE_NAME': 'test-idempotency-table',
}


def _invoke_lambda(entity_type: str, entity_id: str, mock_dal: MagicMock) -> dict[str, Any]:
    """Invoke the lambda handler through the full API Gateway resolver path."""
    import activity_service.handlers.handle_get_activity as handler_module
    from activity_service.dal import get_dal_handler

    get_dal_handler.cache_clear()

    with (
        patch.dict('os.environ', _ENV_VARS),
        patch.object(handler_module, 'get_dal_handler', return_value=mock_dal),
    ):
        result: dict[str, Any] = handler_module.lambda_handler(
            _make_api_gw_event(entity_type, entity_id),
            _make_lambda_context(),
        )
    return result


def _make_activity(entity_id: str = 'product-123', entity_type: str = 'product') -> Activity:
    return Activity(
        entity_id=entity_id,
        entity_type=entity_type,
        activities=[ActivityItem(type='product_created', activity_time=1640995200)],
    )


class TestGetActivityHandlerSuccess:
    def test_returns_200_with_activity_data_when_entity_exists(self) -> None:
        """Should return HTTP 200 with activity data when the entity has activities."""
        mock_dal = MagicMock()
        mock_dal.get_activity.return_value = _make_activity()

        result = _invoke_lambda('product', 'product-123', mock_dal)

        assert result['statusCode'] == HTTPStatus.OK
        body = json.loads(result['body'])
        assert body['entity_id'] == 'product-123'
        assert body['entity_type'] == 'product'
        assert len(body['activities']) == 1


class TestGetActivityHandlerErrorHandling:
    def test_returns_500_when_dal_raises_exception(self) -> None:
        """Should return HTTP 500 when the DAL raises an unexpected exception."""
        mock_dal = MagicMock()
        mock_dal.get_activity.side_effect = RuntimeError('DynamoDB connection failed')

        result = _invoke_lambda('product', 'product-123', mock_dal)

        assert result['statusCode'] == HTTPStatus.INTERNAL_SERVER_ERROR

    def test_error_response_body_contains_error_field_when_dal_raises_exception(self) -> None:
        """Should return a body with an 'error' field (not 'message' or 'details') on exception."""
        mock_dal = MagicMock()
        mock_dal.get_activity.side_effect = RuntimeError('DynamoDB connection failed')

        result = _invoke_lambda('product', 'product-123', mock_dal)

        body = json.loads(result['body'])
        assert 'error' in body
        assert 'message' not in body
        assert 'details' not in body

    def test_does_not_return_200_when_dal_raises_exception(self) -> None:
        """Should never return HTTP 200 when the DAL raises an exception."""
        mock_dal = MagicMock()
        mock_dal.get_activity.side_effect = Exception('unexpected error')

        result = _invoke_lambda('product', 'product-123', mock_dal)

        assert result['statusCode'] != HTTPStatus.OK

    def test_returns_500_when_activity_is_none(self) -> None:
        """Should return HTTP 500 when the DAL returns None (no activity found)."""
        mock_dal = MagicMock()
        mock_dal.get_activity.return_value = None

        result = _invoke_lambda('product', 'product-123', mock_dal)

        assert result['statusCode'] == HTTPStatus.INTERNAL_SERVER_ERROR

    def test_error_response_body_contains_error_field_when_activity_is_none(self) -> None:
        """Should return a body with an 'error' field (not 'message' or 'details') when activity is None."""
        mock_dal = MagicMock()
        mock_dal.get_activity.return_value = None

        result = _invoke_lambda('product', 'product-123', mock_dal)

        body = json.loads(result['body'])
        assert 'error' in body
        assert 'message' not in body
        assert 'details' not in body

    def test_does_not_return_200_when_activity_is_none(self) -> None:
        """Should never return HTTP 200 when the DAL returns None."""
        mock_dal = MagicMock()
        mock_dal.get_activity.return_value = None

        result = _invoke_lambda('product', 'product-123', mock_dal)

        assert result['statusCode'] != HTTPStatus.OK


class TestGetActivityHandlerCORS:
    def test_successful_response_includes_cors_allow_origin_header(self) -> None:
        """Should include Access-Control-Allow-Origin header so browsers can read the response."""
        mock_dal = MagicMock()
        mock_dal.get_activity.return_value = _make_activity()

        result = _invoke_lambda('product', 'product-123', mock_dal)

        assert 'Access-Control-Allow-Origin' in result['headers']

    def test_error_response_includes_cors_allow_origin_header(self) -> None:
        """Should include Access-Control-Allow-Origin header even when an error occurs."""
        mock_dal = MagicMock()
        mock_dal.get_activity.side_effect = RuntimeError('DynamoDB connection failed')

        result = _invoke_lambda('product', 'product-123', mock_dal)

        assert 'Access-Control-Allow-Origin' in result['headers']
