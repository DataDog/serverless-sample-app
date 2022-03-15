# Serverless Sample App

[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?stackName=datadog-serverless-sample-app&templateURL=https://datadog-cloudformation-template-sandbox.s3.amazonaws.com/aws/serverless-sample-app-staging/latest.yaml)

## Try out Datadog:

1. Click "Launch Stack" above.
1. Enter Datadog API Key and the Datadog Site you are registered with and click `Create Stack`.
1. Once the stack has finished creating, open the `Outputs` tab in the stack information view.
1. Invoke your stack 3-4 times by visiting the `ApiGatewayInvokeURL` url given in the `Outputs` tab.
1. Visit Datadog's serverless function view (such as https://app.datadoghq.com/functions for those registered on the US1 site).
1. Search for the the entry function name given in `Outputs`.

## Repository Structure:

This repository is organized into four main files: `template.yaml`, `handler.js`, `handler.py`, and `publish.sh`. 

While our distributed template contains inline lambda code, the code is separated into the  `handler.js` and `handler.py` files in this repo for easier development. The code in these two files are injected into the `template.yaml` during the publishing process through the `publish.sh` script. 

For information on how to inject the code and create a ready-to-use template, refer to the [CONTRIBUTING.md](CONTRIBUTING.MD) file.
