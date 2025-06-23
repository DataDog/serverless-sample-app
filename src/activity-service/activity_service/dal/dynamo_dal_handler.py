from datetime import datetime, timezone

import boto3
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

    @tracer.capture_method(capture_response=False)
    def update_activity(self, activity: Activity) -> Activity:
        logger.info('trying to save activity', entity_id=activity.entity_id, entity_type=activity.entity_type)
        try:
            for item in activity.activities:
                entry_partition_key = f"{activity.entity_id}-{activity.entity_type}"
                entry_sort_key = f"{item.activity_time}"
                entry = ActivityItemEntry(
                    PK=entry_partition_key,
                    SK=entry_sort_key,
                    entity_id=activity.entity_id,
                    entity_type=activity.entity_type,
                    activity_type=item.type,
                    created_at=item.activity_time,
                )
                table: Table = self._get_db_handler(self.table_name)
                table.put_item(Item=entry.model_dump())
        except (ClientError, ValidationError) as exc:  # pragma: no cover
            error_msg = 'failed to store activity'
            logger.exception(error_msg, entity_id=activity.entity_id)
            raise InternalServerException(error_msg) from exc

        logger.info('stored activity successfully', entity_id=activity.entity_id)
        return activity

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
                        activity_time=activity_item.created_at
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
