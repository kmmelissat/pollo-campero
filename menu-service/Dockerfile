FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY menu-service/package.json ./
RUN npm install

COPY menu-service/tsconfig.json ./
COPY menu-service/src ./src/
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/server.js"]
