from __future__ import annotations

from abc import ABC, abstractmethod

from activity_service.models.activity import Activity


# data access handler / integration later adapter class
class DalHandler(ABC):
    @abstractmethod
    def update_activity(self, activity: Activity) -> Activity: ...  # pragma: no cover

    @abstractmethod
    def get_activity(self, entity_id: str, entity_type: str) -> Activity: ...  # pragma: no cover
