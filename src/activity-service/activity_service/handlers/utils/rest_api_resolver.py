from http import HTTPStatus

from aws_lambda_powertools.event_handler import APIGatewayRestResolver, Response, content_types

from activity_service.handlers.utils.observability import logger
from activity_service.models.exceptions import InternalServerException
from activity_service.models.output import InternalServerErrorOutput

ACTIVITY_PATH = '/api/activity/<entity_type>/<entity_id>'

app = APIGatewayRestResolver(enable_validation=False)

@app.exception_handler(InternalServerException)
def handle_internal_server_error(ex: InternalServerException):  # receives exception raised
    logger.exception('finished handling request with internal error')
    return Response(
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR, content_type=content_types.APPLICATION_JSON, body=InternalServerErrorOutput().model_dump()
    )
