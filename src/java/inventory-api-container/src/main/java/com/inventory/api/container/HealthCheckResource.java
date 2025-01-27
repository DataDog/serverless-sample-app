/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.inventory.api.container;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/health")
public class HealthCheckResource {
    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public String hello() {
        return "Healthy!";
    }
}
