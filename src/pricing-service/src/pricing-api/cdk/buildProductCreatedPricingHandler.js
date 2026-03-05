//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//
// CDK build — dd-trace is provided by the Datadog Lambda layer at runtime.
//

const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["./src/pricing-api/adapters/productCreatedPricingHandler.ts"],
    bundle: true,
    minify: true,
    keepNames: true,
    outfile: "out/productCreatedPricingHandler/index.js",
    platform: "node",
    target: ["node22"],
    external: [
      // provided by the Datadog Lambda layer at runtime
      "dd-trace",

      // esbuild cannot bundle native modules
      "@datadog/native-metrics",
      "@datadog/pprof",
      "@datadog/native-appsec",
      "@datadog/native-iast-taint-tracking",
      "@datadog/native-iast-rewriter",

      // graphql
      "graphql/language/visitor",
      "graphql/language/printer",
      "graphql/utilities",

      "@aws-sdk/client-sqs",
    ],
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
