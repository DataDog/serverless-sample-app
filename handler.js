/*
 * Unless explicitly stated otherwise all files in this repository are licensed
 * under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2022 Datadog, Inc.
*/

// SQS Consumer Lambda Function Code
exports.handler = async (event) => {
    console.log(event)
    return {
        "body": "Successfully consumed SQS message",
        "statusCode": 200
    };
}