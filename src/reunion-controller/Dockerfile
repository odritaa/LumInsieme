FROM node:22-alpine

WORKDIR /app/src/reunion-controller

COPY reunion-controller/package.json reunion-controller/package-lock.json ./
RUN npm ci --omit=dev

COPY reunion-controller/src ./src
COPY reunion-controller/db ./db
COPY cache-controller/proto/cache.proto /app/src/cache-controller/proto/cache.proto

ENV NODE_ENV=production PORT=4100 CACHE_GRPC_ADDR=cache-controller:50051

EXPOSE 4100

CMD ["node", "src/server.js"]
