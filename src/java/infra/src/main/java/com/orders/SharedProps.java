package com.orders;

import software.amazon.awscdk.services.secretsmanager.ISecret;

public class SharedProps {
    private final String service;
    private final String env;
    private final String version;
    private final ISecret ddApiKeySecret;

    public SharedProps(String service, String env, String version, ISecret ddApiKeySecret) {
        this.service = service;
        this.env = env;
        this.version = version;
        this.ddApiKeySecret = ddApiKeySecret;
    }

    public ISecret getDdApiKeySecret() {
        return ddApiKeySecret;
    }

    public String getVersion() {
        return version;
    }

    public String getEnv() {
        return env;
    }

    public String getService() {
        return service;
    }
}
