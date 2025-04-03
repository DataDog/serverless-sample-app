FROM ubuntu:22.04 as base

COPY ./local-build-essentials.sh ./local-build-essentials.sh

RUN chmod +x ./local-build-essentials.sh

RUN ./local-build-essentials.sh

COPY ./success-build.sh ./success-build.sh

RUN chmod +x ./success-build.sh

RUN ./success-build.sh

COPY ./local-build.sh ./local-build.sh

RUN chmod +x ./local-build.sh

RUN ./local-build.sh