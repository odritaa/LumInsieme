import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.resolve(__dirname, "../../cache-controller/proto/cache.proto");
const CACHE_GRPC_ADDR = process.env.CACHE_GRPC_ADDR || "localhost:50051";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);
const cacheService = proto.cache.CacheService;

class CacheClient {
  constructor() {
    this.client = null;
    this.buffers = new Map();
    this.flushTimers = new Map();
    this.BATCH_SIZE = 10;
    this.FLUSH_INTERVAL_MS = 3000;
    this.TTL_SECONDS = 259200;
  }

  getClient() {
    if (!this.client) {
      this.client = new cacheService(
        CACHE_GRPC_ADDR,
        grpc.credentials.createInsecure()
      );
    }
    return this.client;
  }

  range(key, start, stop) {
    return new Promise((resolve, reject) => {
      this.getClient().Range({ key, start, stop }, (err, response) => {
        if (err) {
          console.error(`[cache-client] Range error for ${key}:`, err.code, err.message);
          return reject(err);
        }
        resolve(response.values || []);
      });
    });
  }

  pushBatch(key, values, ttlSeconds = this.TTL_SECONDS) {
    return new Promise((resolve, reject) => {
      this.getClient().PushBatch({ key, values, ttl_seconds: ttlSeconds }, (err, response) => {
        if (err) {
          console.error(`[cache-client] PushBatch error for ${key}:`, err.code, err.message);
          return reject(err);
        }
        resolve(response.length);
      });
    });
  }

  health() {
    return new Promise((resolve, reject) => {
      this.getClient().Health({}, (err, response) => {
        if (err) return reject(err);
        resolve(response);
      });
    });
  }

  enqueue(eventId, messageJson) {
    const key = `chat:${eventId}`;
    if (!this.buffers.has(key)) {
      this.buffers.set(key, []);
    }
    const buffer = this.buffers.get(key);
    buffer.push(messageJson);

    if (buffer.length >= this.BATCH_SIZE) {
      this.flush(key);
      return;
    }

    if (!this.flushTimers.has(key)) {
      const timer = setTimeout(() => this.flush(key), this.FLUSH_INTERVAL_MS);
      this.flushTimers.set(key, timer);
    }
  }

  async flush(key) {
    const buffer = this.buffers.get(key);
    if (!buffer || buffer.length === 0) return;

    const messages = buffer.splice(0, buffer.length);
    const timer = this.flushTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(key);
    }

    try {
      await this.pushBatch(key, messages, this.TTL_SECONDS);
    } catch (err) {
      console.error(`[cache-client] flush failed for ${key}:`, err.message);
      buffer.unshift(...messages);
    }
  }

  async flushAll() {
    for (const key of this.buffers.keys()) {
      await this.flush(key);
    }
  }
}

export default new CacheClient();