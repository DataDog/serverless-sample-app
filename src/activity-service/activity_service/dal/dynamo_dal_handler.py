from datetime import datetime, timezone
from uuid import uuid4

import boto3
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError
from cachetools import TTLCache, cached
from mypy_boto3_dynamodb import DynamoDBServiceResource
from mypy_boto3_dynamodb.service_resource import Table
from pydantic import ValidationError

from activity_service.dal.db_handler import DalHandler
from activity_service.dal.models.db import ActivityItemEntry
from activity_service.handlers.utils.observability import logger, tracer
from activity_service.models.activity import Activity, ActivityItem
from activity_service.models.exceptions import InternalServerException


class DynamoDalHandler(DalHandler):
    def __init__(self, table_name: str):
        self.table_name = table_name

    # cache dynamodb connection data for no longer than 5 minutes
    @cached(cache=TTLCache(maxsize=1, ttl=300))
    def _get_db_handler(self, table_name: str) -> Table:
        logger.info('opening connection to dynamodb table', table_name=table_name)
        dynamodb: DynamoDBServiceResource = boto3.resource('dynamodb')
        return dynamodb.Table(table_name)

    def _get_unix_time(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    @staticmethod
    def _build_entry(activity: Activity) -> ActivityItemEntry:
        """Build the DynamoDB entry for the newest activity item on an Activity.

        The sort key combines activity_time, activity_type and event_id so that
        two events for the same entity that share a timestamp (down to the
        second/millisecond) no longer collide and silently overwrite each other.
        """
        new_item = activity.activities[-1]
        entry_partition_key = f"{activity.entity_id}-{activity.entity_type}"
        # event_id keeps the sort key unique per source event. Fall back to a
        # generated uuid only when no event id is available so we never write a
        # colliding sort key.
        event_id = new_item.event_id or f"gen-{uuid4()}"
        entry_sort_key = f"{new_item.activity_time}#{new_item.type}#{event_id}"
        return ActivityItemEntry(
            PK=entry_partition_key,
            SK=entry_sort_key,
            entity_id=activity.entity_id,
            entity_type=activity.entity_type,
            activity_type=new_item.type,
            created_at=new_item.activity_time,
            event_id=new_item.event_id,
        )

    @tracer.capture_method(capture_response=False)
    def update_activity(self, activity: Activity) -> Activity:
        logger.info('trying to save activity', entity_id=activity.entity_id, entity_type=activity.entity_type)
        try:
            entry = self._build_entry(activity)
            table: Table = self._get_db_handler(self.table_name)
            table.put_item(Item=entry.model_dump(exclude_none=True))
        except (ClientError, ValidationError) as exc:  # pragma: no cover
            error_msg = 'failed to store activity'
            logger.exception(error_msg, entity_id=activity.entity_id)
            raise InternalServerException(error_msg) from exc

        logger.info('stored activity successfully', entity_id=activity.entity_id)
        return activity

    @tracer.capture_method(capture_response=False)
    def save_activities(self, activities: list[Activity]) -> None:
        """Atomically persist the newest item of each supplied Activity.

        Uses TransactWriteItems so that a multi-row write (e.g. an order row and
        the corresponding user row for a single event) either fully succeeds or
        fully fails. This removes the partial-write window that previously left
        inconsistent state under one idempotency key.
        """
        if not activities:
            return

        try:
            entries = [self._build_entry(activity) for activity in activities]
            table: Table = self._get_db_handler(self.table_name)
            serializer = TypeSerializer()
            transact_items = [
                {
                    'Put': {
                        'TableName': self.table_name,
                        'Item': {
                            key: serializer.serialize(value)
                            for key, value in entry.model_dump(exclude_none=True).items()
                        },
                    }
                }
                for entry in entries
            ]
            table.meta.client.transact_write_items(TransactItems=transact_items)
        except (ClientError, ValidationError) as exc:  # pragma: no cover
            error_msg = 'failed to store activities'
            logger.exception(error_msg)
            raise InternalServerException(error_msg) from exc

        logger.info('stored activities successfully', count=len(activities))

    def get_activity(self, entity_id: str, entity_type: str) -> Activity:
        table: Table = self._get_db_handler(self.table_name)
        partition_key = f"{entity_id}-{entity_type}"

        logger.info('querying activity items', entity_id=entity_id, entity_type=entity_type)

        try:
            response = table.query(
                KeyConditionExpression="PK = :pk",
                ExpressionAttributeValues={
                    ":pk": partition_key
                }
            )

            items = response.get('Items', [])

            if not items:
                logger.warning('no activities found', entity_id=entity_id, entity_type=entity_type)
                return Activity(entity_id=entity_id, entity_type=entity_type, activities=[])

            # Create the Activity object first
            activity = Activity(
                entity_id=entity_id,
                entity_type=entity_type,
                activities=[]
            )

            # Process all items and add them to the activities list
            for item in items:
                try:
                    activity_item = ActivityItemEntry.model_validate(item)
                    activity.activities.append(ActivityItem(
                        type=activity_item.activity_type,
                        activity_time=activity_item.created_at,
                        event_id=activity_item.event_id,
                    ))
                except ValidationError:
                    logger.warning('failed to validate activity item, skipping',
                                   entity_id=entity_id, sort_key=item.get('SK'))

            logger.info('activities retrieved successfully',
                        entity_id=entity_id, count=len(activity.activities))
            return activity

        except ClientError as exc:
            error_msg = 'failed to query activities'
            logger.exception(error_msg, entity_id=entity_id, entity_type=entity_type)
            raise InternalServerException(error_msg) from exc
