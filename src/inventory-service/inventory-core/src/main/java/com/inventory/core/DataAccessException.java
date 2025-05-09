package com.inventory.core;

public class DataAccessException extends RuntimeException {
    private final Exception innerException;

    public DataAccessException(Exception innerException) {
        super(innerException);
        this.innerException = innerException;
    }

    public Exception getInnerException() {
        return this.innerException;
    }
}
