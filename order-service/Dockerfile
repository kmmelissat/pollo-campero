FROM node:20-alpine

RUN apk add --no-cache curl openssl libc6-compat

WORKDIR /app

COPY shared/package.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
RUN cd /app/shared && npm install && npm run build

COPY order-service/package.json ./order-service/
WORKDIR /app/order-service
RUN npm install

COPY order-service/prisma ./prisma
COPY order-service/src ./src
COPY order-service/tsconfig.json ./
COPY order-service/docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

RUN npx prisma generate
RUN npm run build

EXPOSE 3002

ENTRYPOINT ["./docker-entrypoint.sh"]
