package com.cdk.constructs;

import software.amazon.awscdk.services.secretsmanager.ISecret;

public record SharedProps(String service, String env, String version, ISecret ddApiKeySecret) {
}
