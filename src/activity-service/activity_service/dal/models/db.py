from typing import Annotated

from pydantic import BaseModel, Field


class ActivityItemEntry(BaseModel):
    PK: Annotated[str, Field(min_length=1)] # primary key
    SK: Annotated[str, Field(min_length=1)] # sort key
    entity_id: Annotated[str, Field(min_length=1)]
    entity_type: Annotated[str, Field(min_length=1)]
    activity_type: Annotated[str, Field(min_length=1)]
    created_at: Annotated[int, Field(description='The time the event was started')]
