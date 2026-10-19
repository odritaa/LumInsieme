FROM node:22-alpine

WORKDIR /app/src/chat-controller

COPY chat-controller/package.json chat-controller/package-lock.json ./
RUN npm ci --omit=dev

COPY chat-controller/src ./src
COPY cache-controller/proto/cache.proto /app/src/cache-controller/proto/cache.proto

ENV NODE_ENV=production PORT=3000 CACHE_GRPC_ADDR=cache-controller:50051

EXPOSE 3000

CMD ["node", "src/server.js"]
