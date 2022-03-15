// SQS Consumer Lambda Function Code
exports.handler = async (event) => {
    console.log(event)
    return {
        "body": "Successfully consumed SQS message",
        "statusCode": 200
    };
}