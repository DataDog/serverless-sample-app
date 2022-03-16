# Serverless Sample App

[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?stackName=datadog-serverless-sample-app&templateURL=https://datadog-cloudformation-template-sandbox.s3.amazonaws.com/aws/serverless-sample-app-staging/latest.yaml)

For more information on Datadog Serverless, check out our [Serverless Info](https://docs.datadoghq.com/serverless) page!

## Try out Datadog:

1. Click "Launch Stack" above.
1. Enter Datadog API Key and the Datadog Site you are registered with, acknowledge IAM Capabilities, and click `Create Stack`. See [this link](https://docs.datadoghq.com/account_management/api-app-keys/) for more info on API keys.
1. Once the stack has finished creating, open the `Outputs` tab in the stack information view.
1. Invoke your stack 3-4 times by visiting the `ApiGatewayInvokeURL` url given in the `Outputs` tab.
1. Wait a couple minutes for the data to finish flushing to Datadog.
1. Visit the `DatadogFunctionLink` in the `Outputs` tab to explore your data.
    - Alternatively, visit Datadog's serverless view for your registered site (such as https://app.datadoghq.com/functions for those registered on the US1 site).
    - Under `Function Name` on the left side of the site, search for the the entry function name also given in the stack `Outputs` tab.

## Sample App Architecture

![Architecture](assets/app_architecture.png)

## Sample Trace Map
- The trace map of your resources you can expect to see in Datadog.

![Sample Trace Map](assets/sample_trace_map.png)

## Repository Structure:

This repository is organized into four main files: `template.yaml`, `handler.js`, `handler.py`, and `publish.sh`. 

While our distributed template contains inline lambda code, the code is separated into  `handler.js` and `handler.py` files in this repo for easier development. The code in these two files are injected into the `template.yaml` during the publishing process through the `publish.sh` script. 

For information on how to inject the code and create a ready-to-use template outside publishing, refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file.
