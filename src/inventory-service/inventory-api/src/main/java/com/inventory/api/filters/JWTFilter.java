package com.inventory.api.filters;

import com.inventory.api.Authenticator;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.ext.Provider;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.io.IOException;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class JWTFilter implements ContainerRequestFilter {
    private static final org.jboss.logging.Logger LOGGER = Logger.getLogger("Listener");

    @Inject
    Authenticator authenticator;

    @Context
    ResourceInfo resourceInfo;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(requestContext.getMethod())) {
            return;
        }

        if (isPublicEndpoint()) {
            return;
        }

        String authorizationHeader = requestContext.getHeaderString(HttpHeaders.AUTHORIZATION);

        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            abortWithUnauthorized(requestContext);
            return;
        }

        String token = authorizationHeader.substring("Bearer".length()).trim();
        var authResult = authenticator.AuthorizeAdmin(token);

        if (!authResult) {
            abortWithUnauthorized(requestContext);
        }
    }

    private boolean isPublicEndpoint() {
        if (resourceInfo == null) {
            return false;
        }

        var method = resourceInfo.getResourceMethod();
        if (method != null && method.isAnnotationPresent(PublicEndpoint.class)) {
            return true;
        }

        var resourceClass = resourceInfo.getResourceClass();
        return resourceClass != null && resourceClass.isAnnotationPresent(PublicEndpoint.class);
    }

    private void abortWithUnauthorized(ContainerRequestContext requestContext) {
        requestContext.abortWith(Response.status(Response.Status.UNAUTHORIZED).build());
    }
}
