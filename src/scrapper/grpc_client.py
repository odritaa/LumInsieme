import json

import grpc
from grpc import aio

from utils.config import GRPC_CONFIG
from pb import cache_pb2, cache_pb2_grpc


class CacheClient:
    def __init__(self, host=None, port=None):
        self.host = host or GRPC_CONFIG["host"]
        self.port = port or GRPC_CONFIG["port"]
        self._channel = None
        self.stub = None

    def connect(self):
        self._channel = aio.insecure_channel(f"{self.host}:{self.port}")
        self.stub = cache_pb2_grpc.CacheServiceStub(self._channel)

    async def set_with_ttl(self, key: str, value: str, ttl_seconds: int) -> bool:
        request = cache_pb2.SetWithTTLRequest(key=key, value=value, ttl_seconds=ttl_seconds)
        response = await self.stub.SetWithTTL(request)
        return response.ok

    async def set_json(self, key: str, data, ttl_seconds: int) -> bool:
        serialized = json.dumps(data, ensure_ascii=False)
        return await self.set_with_ttl(key, serialized, ttl_seconds)

    async def get(self, key: str):
        request = cache_pb2.GetRequest(key=key)
        response = await self.stub.Get(request)
        if not response.found:
            return None
        return json.loads(response.value)

    async def health(self) -> bool:
        response = await self.stub.Health(cache_pb2.HealthRequest())
        return response.redis_connected

    async def close(self):
        if self._channel:
            await self._channel.close()
