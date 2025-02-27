//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import tracer from "dd-trace";
const logger = require("./adapters/logger");
tracer.init({ logger, logInjection: true }); // initialized in a different file to avoid hoisting.
export default tracer;
