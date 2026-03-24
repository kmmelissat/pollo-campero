FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY shared/package.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
RUN cd /app/shared && npm install && npm run build

COPY notification-service/package.json ./notification-service/
WORKDIR /app/notification-service
RUN npm install

COPY notification-service/tsconfig.json ./
COPY notification-service/src ./src/
RUN npm run build

EXPOSE 3003

CMD ["node", "dist/server.js"]
