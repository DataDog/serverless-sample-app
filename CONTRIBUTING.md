# Contributing

We love pull requests. Here's a quick guide.

_Please refer to the [README.md](README.md) for information about the structure of this repo_

1. Fork, clone and branch off `main`:
    ```bash
    git clone git@github.com:<your-username>/serverless-sample-app.git
    git checkout -b <my-branch>
    ```
1. Make your changes to the lambda handlers (`handler.js` or `handler.py`), or to the `template.yaml` itself.
1. Run the following two commands in the root of this repo:
    ```bash
    awk -v STRING_TO_REPLACE="INJECT_ENTRY_FUNCTION_CODE_PLACEHOLDER" -f inject_inline_code.awk handler.py template.yaml > dist/template.yaml
    awk -v STRING_TO_REPLACE="INJECT_SQS_CONSUMER_CODE_PLACEHOLDER" -f inject_inline_code.awk handler.js dist/template.yaml > tmp && mv tmp dist/template.yaml
    ```

    This will create a `dist/template.yaml` with the lambda code injected within that is ready to use.

1. Open the AWS CloudFormation console: https://console.aws.amazon.com/cloudformation
1. Click create stack, specifying and uploading the `dist/template.yaml` as the template and including your Datadog API key and site as parameters when prompted.
1. Once the stack is deployed, test your changes by invoking the entry lambda function and checking the Datadog site (see [README.md](README.md) for more info)