from typing import Annotated, Any

from aws_lambda_env_modeler import get_environment_variables, init_environment_variables
from aws_lambda_powertools.event_handler.openapi.params import Path
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext

from activity_service.dal import DalHandler, get_dal_handler
from activity_service.handlers.models.env_vars import HandlerEventVars
from activity_service.handlers.utils.observability import logger
from activity_service.handlers.utils.rest_api_resolver import ACTIVITY_PATH, app
from activity_service.models.activity import Activity
from activity_service.models.output import InternalServerErrorOutput


@app.get(ACTIVITY_PATH)
def handle_get_activities(entity_type: Annotated[str, Path()], entity_id: Annotated[str, Path()]) -> Activity:
    env_vars: HandlerEventVars = get_environment_variables(model=HandlerEventVars)
    logger.debug('environment variables', env_vars=env_vars.model_dump())
    logger.info('got list activities request', entity_id=entity_id)

    dal_handler: DalHandler = get_dal_handler(env_vars.TABLE_NAME)

    try:
        activities = dal_handler.get_activity(entity_id, entity_type)
        if activities is None:
            logger.warning('No activities found for entity', entity_id=entity_id)
            return InternalServerErrorOutput(
                message='An error occurred while retrieving activities',
                details=str(e),
            )

        logger.info('Activities retrieved successfully', entity_id=entity_id, activities=activities)
        return activities
    except Exception as e:
        logger.exception('Error retrieving activities', entity_id=entity_id, error=str(e))
        return InternalServerErrorOutput(
            message='An error occurred while retrieving activities',
            details=str(e),
        )

@init_environment_variables(model=HandlerEventVars)
@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_REST)
def lambda_handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    return app.resolve(event, context)
