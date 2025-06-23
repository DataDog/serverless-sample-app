from typing import Annotated

from pydantic import BaseModel, Field


class Activity(BaseModel):
    entity_id: Annotated[str, Field(min_length=1, description='The ID of the underlying entity')]
    entity_type: Annotated[str, Field(min_length=1, description='The type of entity, product, customer, order etc')]
    activities: Annotated[list['ActivityItem'], Field(description='The list of activities')]

class ActivityItem(BaseModel):
    type: Annotated[str, Field(min_length=1, description='The type of event')]
    activity_time: Annotated[int, Field(description='The time the event was started')]
