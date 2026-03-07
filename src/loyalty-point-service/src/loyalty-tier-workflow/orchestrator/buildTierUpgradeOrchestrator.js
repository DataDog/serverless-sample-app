//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: [
      "./src/loyalty-tier-workflow/orchestrator/tierUpgradeOrchestrator.ts",
    ],
    bundle: true,
    minify: true,
    keepNames: true,
    outfile: "out/tierUpgradeOrchestrator/index.js",
    platform: "node", // allows built-in modules to be required
    target: ["node22"],
    external: [
      // provided by the Datadog Lambda layer at runtime
      "dd-trace",

      // esbuild cannot bundle native modules
      "@datadog/native-metrics",

      // required if you use profiling
      "@datadog/pprof",

      // required if you use Datadog security features
      "@datadog/native-appsec",
      "@datadog/native-iast-taint-tracking",
      "@datadog/native-iast-rewriter",

      // required if you encounter graphql errors during the build step
      "graphql/language/visitor",
      "graphql/language/printer",
      "graphql/utilities",

      // AWS SDK provided by Lambda runtime
      "@aws-sdk/client-sqs",
      "@aws-sdk/client-dynamodb",
      "@aws-sdk/client-eventbridge",
      "@aws-sdk/client-ssm",

      // NOTE: @aws-sdk/client-lambda is intentionally NOT external here.
      // @aws/durable-execution-sdk-js uses clientLambda.OperationStatus.SUCCEEDED
      // internally. The Lambda runtime ships an older Lambda SDK that does not
      // export OperationStatus, causing a runtime TypeError. Bundling the SDK
      // ensures the correct version (>=3.1004.0) is used.

      // @aws/durable-execution-sdk-js is bundled (NOT external) so the
      // orchestrator replay determinism is preserved within the bundle.
      // Do NOT add it here.
    ],
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
