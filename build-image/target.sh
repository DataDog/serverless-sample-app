#!/bin/bash
set -e

# Map TARGETPLATFORM to arch
case "$TARGETPLATFORM" in
    "linux/amd64")
        export TARGET_ARCHITECTURE="x86_64"
        ;;
    "linux/arm64")
        export TARGET_ARCHITECTURE="arm64"
        ;;
    *)
        echo "Unsupported platform: $TARGETPLATFORM"
        exit 1
        ;;
esac