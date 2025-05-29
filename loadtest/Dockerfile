FROM node:22-alpine

WORKDIR /usr/app
COPY ./ /usr/app
RUN npm install -g artillery@latest
RUN npm install

CMD ["artillery", "run", "loadsimulator.yml"]