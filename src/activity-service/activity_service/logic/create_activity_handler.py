from activity_service.dal.db_handler import DalHandler
from activity_service.models.activity import ActivityItem
from activity_service.models.input import CreateActivityRequest


def create_activity_handler(request: CreateActivityRequest, dal_handler: DalHandler) -> dict:
    """
    Handle the creation of an activity based on the provided request.

    Args:
        request (CreateActivityRequest): The request containing activity details.

    Returns:
        dict: A dictionary containing the status and message of the operation.

    Parameters
    ----------
    request
    dal_handler
    """
    # Here you would typically call a DAL handler to save the activity
    # For demonstration, we will just return a success message
    existing_activity = dal_handler.get_activity(request.entityId, request.entityType)

    existing_activity.activities.append(ActivityItem(
        type=request.activityType,
        activity_time=request.activityTime
    ))

    dal_handler.update_activity(existing_activity)

    return {
        "status": "success",
        "message": f"Activity of type '{request.activityType}' for entity '{request.entityId}' created successfully."
    }
