# Serverless Sample App

[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?stackName=datadog-serverless-sample-app&templateURL=https://david-cloudformation-template-test.s3.amazonaws.com/aws/sample-app-staging/latest.yaml)

Steps for trying out Datadog:

1. Click "Launch Stack" above, provide your Datadog API key in the parameters section.
1. Ensure you are on a supported AWS region (see above), and click "Create Stack".
1. Once the stack has finished creating, open the "Outputs" tab in the stack information view.
1. Invoke your stack 3-4 times by visiting the "ApiGatewayInvokeURL" url given in the "Outputs" tab.
1. Visit Datadog's serverless function view (such as https://app.datadoghq.com/functions for those registered on the US1 site) and search for the "datadog-serverless-sample-app" tag

