//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["./src/pricing-api/workshop/calculatePricingFunction.ts"],
    bundle: true,
    minify: true,
    outfile: "out/calculatePricingFunction/index.js",
    platform: "node",
    target: ["node22"],
    external: [
      "@aws-sdk/client-eventbridge",
      "@aws-sdk/client-ssm",
    ],
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
