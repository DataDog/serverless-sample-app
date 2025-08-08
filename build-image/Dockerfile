FROM --platform=${BUILDPLATFORM} ubuntu:22.04 AS base

ARG TARGETPLATFORM
ARG DEBIAN_FRONTEND=noninteractive

COPY ./target.sh ./target.sh
RUN chmod +x ./target.sh
RUN . ./target.sh

COPY ./local-build-essentials.sh ./local-build-essentials.sh
RUN chmod +x ./local-build-essentials.sh
RUN . ./target.sh && ./local-build-essentials.sh

COPY ./success-build.sh ./success-build.sh
RUN chmod +x ./success-build.sh
RUN . ./target.sh && ./success-build.sh

COPY ./local-build.sh ./local-build.sh
RUN chmod +x ./local-build.sh
RUN . ./target.sh && ./local-build.sh