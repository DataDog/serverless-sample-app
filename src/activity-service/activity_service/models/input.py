from typing import Annotated

from pydantic import BaseModel, Field


class CreateActivityRequest(BaseModel):
    entityId: Annotated[str, Field(min_length=1, description='The ID of the underlying entity')]
    entityType: Annotated[str, Field(min_length=1, description='The type of the entity')]
    activityType: Annotated[str, Field(min_length=1, description='The type of the activity')]
    activityTime: Annotated[int, Field(description='The time the activity was started')]
