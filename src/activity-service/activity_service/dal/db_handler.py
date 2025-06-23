from abc import ABC, ABCMeta, abstractmethod

from activity_service.models.activity import Activity


class _SingletonMeta(ABCMeta):
    _instances: dict = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(_SingletonMeta, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


# data access handler / integration later adapter class
class DalHandler(ABC, metaclass=_SingletonMeta):
    @abstractmethod
    def update_activity(self, activity: Activity) -> Activity: ...  # pragma: no cover

    @abstractmethod
    def get_activity(self, entity_id: str, entity_type: str) -> Activity: ...  # pragma: no cover
