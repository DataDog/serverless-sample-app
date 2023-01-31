/*
 * Unless explicitly stated otherwise all files in this repository are licensed
 * under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2023 Datadog, Inc.
*/

const AWS = require('aws-sdk');
const AWS_REGION = process.env.AWS_REGION;
AWS.config.update({region: AWS_REGION});

exports.handler = async (event, context, callback) => {
    const dynamodb = new AWS.DynamoDB.DocumentClient({
        apiVersion: '2012-08-10',
        region: AWS_REGION
    });

    const params = {
        TableName: "DatadogDemoStepFunctionsTracingTable",
        KeyConditionExpression: "pk = :id",
        ProjectionExpression: "countValue",
        ExpressionAttributeValues: {
            ":id": "triggerCounts"
        }
    };

    const ddbResp = await dynamodb.query(params).promise();
    let count = null;
    if (ddbResp !== null && ddbResp.Count > 0) {
        count = ddbResp.Items[0].countValue
    }

    return {
        statusCode: 200,
        body: "The demo state machine has been triggered " + count + " time(s)."
    };
};
