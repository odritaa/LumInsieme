import json

import grpc
import pytest

from grpc_client import CacheClient
from pb import cache_pb2, cache_pb2_grpc


class FakeCache(cache_pb2_grpc.CacheServiceServicer):
    def __init__(self):
        self.store = {}
        self.ttls = {}

    async def SetWithTTL(self, request, context):
        self.store[request.key] = request.value
        self.ttls[request.key] = request.ttl_seconds
        return cache_pb2.SetWithTTLResponse(ok=True)

    async def Get(self, request, context):
        if request.key not in self.store:
            return cache_pb2.GetResponse(found=False)
        return cache_pb2.GetResponse(value=self.store[request.key], found=True)

    async def Health(self, request, context):
        return cache_pb2.HealthResponse(status="healthy", redis_connected=True)


@pytest.fixture
async def client():
    # cache-controller falso servido por gRPC aio: ejercita el stub y los mensajes reales.
    fake = FakeCache()
    server = grpc.aio.server()
    cache_pb2_grpc.add_CacheServiceServicer_to_server(fake, server)
    port = server.add_insecure_port("127.0.0.1:0")
    await server.start()
    cache_client = CacheClient(host="127.0.0.1", port=port)
    cache_client.connect()
    yield cache_client, fake
    await cache_client.close()
    await server.stop(None)


async def test_set_with_ttl(client):
    """PT-TR-25 CacheClient.set_with_ttl → SetWithTTLRequest con clave, valor y TTL; devuelve ok"""
    cache_client, fake = client
    assert await cache_client.set_with_ttl("scraped_data", "[]", 3600) is True
    assert fake.store["scraped_data"] == "[]"
    assert fake.ttls["scraped_data"] == 3600


async def test_set_json_y_get(client):
    """PT-TR-26 set_json + get → serializa sin escapar acentos y get devuelve el objeto decodificado"""
    cache_client, fake = client
    await cache_client.set_json("k", {"titulo": "Película"}, 60)
    assert fake.store["k"] == '{"titulo": "Película"}'
    assert await cache_client.get("k") == {"titulo": "Película"}


async def test_get_inexistente_y_health(client):
    """PT-TR-27 get de clave inexistente → None; health → redis_connected"""
    cache_client, _ = client
    assert await cache_client.get("no-existe") is None
    assert await cache_client.health() is True


def test_configuracion_por_entorno():
    """PT-TR-28 CacheClient sin argumentos → host y puerto desde GRPC_HOST/GRPC_PORT"""
    cache_client = CacheClient()
    assert (cache_client.host, cache_client.port) == ("127.0.0.1", 50998)
    json.dumps({})
