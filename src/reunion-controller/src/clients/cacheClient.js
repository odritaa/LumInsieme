import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../config.js";

const PROTO_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../cache-controller/proto/cache.proto"
);
const DEADLINE_MS = 2000;

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const { CacheService } = grpc.loadPackageDefinition(packageDefinition).cache;

let client = null;

function getClient() {
  if (!client) client = new CacheService(config.cacheGrpcAddr, grpc.credentials.createInsecure());
  return client;
}

function call(method, request) {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + DEADLINE_MS);
    getClient()[method](request, { deadline }, (error, response) => {
      if (error) return reject(error);
      resolve(response);
    });
  });
}

export async function get(key) {
  const response = await call("Get", { key });
  return response.found ? response.value : null;
}

export async function health() {
  const response = await call("Health", {});
  return response.redis_connected;
}
