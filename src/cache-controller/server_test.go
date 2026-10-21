package main

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	pb "github.com/odritaa/LumInsieme/src/cache-controller/pb"
)

func newTestServer(t *testing.T) (*cacheServer, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr(), MaxRetries: -1})
	t.Cleanup(func() { rdb.Close() })
	return newCacheServer(rdb), mr
}

// Cliente gRPC real sobre un listener en memoria: ejercita el registro del servicio y la serializacion.
func newGRPCClient(t *testing.T, srv *cacheServer) pb.CacheServiceClient {
	t.Helper()
	lis := bufconn.Listen(1 << 20)
	grpcServer := grpc.NewServer()
	pb.RegisterCacheServiceServer(grpcServer, srv)
	go grpcServer.Serve(lis)
	t.Cleanup(grpcServer.Stop)

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return lis.DialContext(ctx) }),
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { conn.Close() })
	return pb.NewCacheServiceClient(conn)
}

func TestKeyValue(t *testing.T) {
	ctx := context.Background()

	t.Run("PT-TR-30 Get de una clave inexistente → found=false sin error", func(t *testing.T) {
		srv, _ := newTestServer(t)
		res, err := srv.Get(ctx, &pb.GetRequest{Key: "no-existe"})
		require.NoError(t, err)
		assert.False(t, res.Found)
		assert.Empty(t, res.Value)
	})

	t.Run("PT-TR-31 Set y luego Get → devuelve el mismo valor y la clave no vence", func(t *testing.T) {
		srv, mr := newTestServer(t)
		set, err := srv.Set(ctx, &pb.SetRequest{Key: "k", Value: `{"a":1}`})
		require.NoError(t, err)
		assert.True(t, set.Ok)
		res, err := srv.Get(ctx, &pb.GetRequest{Key: "k"})
		require.NoError(t, err)
		assert.True(t, res.Found)
		assert.Equal(t, `{"a":1}`, res.Value)
		assert.Equal(t, time.Duration(0), mr.TTL("k"))
	})

	t.Run("PT-TR-32 Delete y Exists → reflejan la existencia de la clave", func(t *testing.T) {
		srv, mr := newTestServer(t)
		require.NoError(t, mr.Set("k", "v"))
		ex, _ := srv.Exists(ctx, &pb.ExistsRequest{Key: "k"})
		assert.True(t, ex.Exists)
		del, err := srv.Delete(ctx, &pb.DeleteRequest{Key: "k"})
		require.NoError(t, err)
		assert.True(t, del.Deleted)
		again, _ := srv.Delete(ctx, &pb.DeleteRequest{Key: "k"})
		assert.False(t, again.Deleted)
		ex, _ = srv.Exists(ctx, &pb.ExistsRequest{Key: "k"})
		assert.False(t, ex.Exists)
	})
}

func TestTTL(t *testing.T) {
	ctx := context.Background()

	t.Run("PT-TR-33 SetWithTTL (cartelera del scrapper) → la clave vence al cumplirse el TTL", func(t *testing.T) {
		srv, mr := newTestServer(t)
		res, err := srv.SetWithTTL(ctx, &pb.SetWithTTLRequest{Key: "scraped_data", Value: "[]", TtlSeconds: 3600})
		require.NoError(t, err)
		assert.True(t, res.Ok)
		assert.Equal(t, time.Hour, mr.TTL("scraped_data"))

		mr.FastForward(3599 * time.Second)
		get, _ := srv.Get(ctx, &pb.GetRequest{Key: "scraped_data"})
		assert.True(t, get.Found)

		mr.FastForward(time.Second)
		get, _ = srv.Get(ctx, &pb.GetRequest{Key: "scraped_data"})
		assert.False(t, get.Found)
	})

	t.Run("PT-TR-34 SetTTL sobre una clave existente y GetTTL → devuelve los segundos restantes", func(t *testing.T) {
		srv, mr := newTestServer(t)
		require.NoError(t, mr.Set("k", "v"))
		_, err := srv.SetTTL(ctx, &pb.SetTTLRequest{Key: "k", TtlSeconds: 120})
		require.NoError(t, err)
		ttl, err := srv.GetTTL(ctx, &pb.GetTTLRequest{Key: "k"})
		require.NoError(t, err)
		assert.Equal(t, int64(120), ttl.TtlSeconds)
	})

	t.Run("PT-TR-35 GetTTL de clave sin vencimiento → -1; de clave inexistente → -2 (semántica Redis)", func(t *testing.T) {
		srv, mr := newTestServer(t)
		require.NoError(t, mr.Set("persistente", "v"))
		persistent, _ := srv.GetTTL(ctx, &pb.GetTTLRequest{Key: "persistente"})
		missing, _ := srv.GetTTL(ctx, &pb.GetTTLRequest{Key: "no-existe"})
		assert.Equal(t, int64(-1), persistent.TtlSeconds)
		assert.Equal(t, int64(-2), missing.TtlSeconds)
	})
}

func TestLists(t *testing.T) {
	ctx := context.Background()

	t.Run("PT-TR-36 PushBatch (chat) → agrega en orden, devuelve la longitud y aplica el TTL", func(t *testing.T) {
		srv, mr := newTestServer(t)
		_, err := srv.Push(ctx, &pb.PushRequest{Key: "chat:s1", Value: "m0"})
		require.NoError(t, err)
		res, err := srv.PushBatch(ctx, &pb.PushBatchRequest{Key: "chat:s1", Values: []string{"m1", "m2", "m3"}, TtlSeconds: 259200})
		require.NoError(t, err)
		assert.Equal(t, int64(4), res.Length)
		list, _ := mr.List("chat:s1")
		assert.Equal(t, []string{"m0", "m1", "m2", "m3"}, list)
		assert.Equal(t, 72*time.Hour, mr.TTL("chat:s1"))
	})

	t.Run("PT-TR-37 PushBatch vacío → longitud 0 y no crea la clave", func(t *testing.T) {
		srv, mr := newTestServer(t)
		res, err := srv.PushBatch(ctx, &pb.PushBatchRequest{Key: "chat:vacio", TtlSeconds: 60})
		require.NoError(t, err)
		assert.Equal(t, int64(0), res.Length)
		assert.False(t, mr.Exists("chat:vacio"))
	})

	t.Run("PT-TR-38 PushBatch con TTL 0 → no fija vencimiento", func(t *testing.T) {
		srv, mr := newTestServer(t)
		_, err := srv.PushBatch(ctx, &pb.PushBatchRequest{Key: "chat:s2", Values: []string{"a"}})
		require.NoError(t, err)
		assert.Equal(t, time.Duration(0), mr.TTL("chat:s2"))
	})

	t.Run("PT-TR-39 Range con índices negativos (-50, -1) → últimos N mensajes en orden cronológico", func(t *testing.T) {
		srv, _ := newTestServer(t)
		values := make([]string, 60)
		for i := range values {
			values[i] = string(rune('A' + i%26))
		}
		_, err := srv.PushBatch(ctx, &pb.PushBatchRequest{Key: "chat:s3", Values: values})
		require.NoError(t, err)
		res, err := srv.Range(ctx, &pb.RangeRequest{Key: "chat:s3", Start: -50, Stop: -1})
		require.NoError(t, err)
		assert.Equal(t, values[10:], res.Values)
	})

	t.Run("PT-TR-40 Range de una sala sin historial → lista vacía sin error", func(t *testing.T) {
		srv, _ := newTestServer(t)
		res, err := srv.Range(ctx, &pb.RangeRequest{Key: "chat:nueva", Start: -50, Stop: -1})
		require.NoError(t, err)
		assert.Empty(t, res.Values)
	})
}

func TestHashesAndPubSub(t *testing.T) {
	ctx := context.Background()

	t.Run("PT-TR-41 HSet/HGet/HGetAll/HDel → CRUD de campos de un hash", func(t *testing.T) {
		srv, _ := newTestServer(t)
		_, err := srv.HSet(ctx, &pb.HSetRequest{Key: "h", Field: "a", Value: "1"})
		require.NoError(t, err)
		_, _ = srv.HSet(ctx, &pb.HSetRequest{Key: "h", Field: "b", Value: "2"})
		got, _ := srv.HGet(ctx, &pb.HGetRequest{Key: "h", Field: "a"})
		assert.True(t, got.Found)
		assert.Equal(t, "1", got.Value)
		missing, _ := srv.HGet(ctx, &pb.HGetRequest{Key: "h", Field: "z"})
		assert.False(t, missing.Found)
		all, _ := srv.HGetAll(ctx, &pb.HGetAllRequest{Key: "h"})
		assert.Equal(t, map[string]string{"a": "1", "b": "2"}, all.Fields)
		del, _ := srv.HDel(ctx, &pb.HDelRequest{Key: "h", Field: "a"})
		assert.True(t, del.Deleted)
	})

	t.Run("PT-TR-42 Subscribe por gRPC (stream) + Publish → el suscriptor recibe el mensaje", func(t *testing.T) {
		srv, _ := newTestServer(t)
		client := newGRPCClient(t, srv)
		streamCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		stream, err := client.Subscribe(streamCtx, &pb.SubscribeRequest{Channel: "sala:1"})
		require.NoError(t, err)

		require.Eventually(t, func() bool {
			res, err := client.Publish(ctx, &pb.PublishRequest{Channel: "sala:1", Message: "hola"})
			return err == nil && res.Subscribers == 1
		}, 2*time.Second, 20*time.Millisecond)

		msg, err := stream.Recv()
		require.NoError(t, err)
		assert.Equal(t, "sala:1", msg.Channel)
		assert.Equal(t, "hola", msg.Message)
	})
}

func TestGRPCAndFailures(t *testing.T) {
	ctx := context.Background()

	t.Run("PT-TR-43 Cliente gRPC: SetWithTTL + Get + PushBatch + Range de punta a punta", func(t *testing.T) {
		srv, _ := newTestServer(t)
		client := newGRPCClient(t, srv)
		_, err := client.SetWithTTL(ctx, &pb.SetWithTTLRequest{Key: "scraped_data", Value: "[1]", TtlSeconds: 10})
		require.NoError(t, err)
		got, err := client.Get(ctx, &pb.GetRequest{Key: "scraped_data"})
		require.NoError(t, err)
		assert.Equal(t, "[1]", got.Value)
		_, err = client.PushBatch(ctx, &pb.PushBatchRequest{Key: "chat:x", Values: []string{"a", "b"}, TtlSeconds: 10})
		require.NoError(t, err)
		rng, err := client.Range(ctx, &pb.RangeRequest{Key: "chat:x", Start: 0, Stop: -1})
		require.NoError(t, err)
		assert.Equal(t, []string{"a", "b"}, rng.Values)
	})

	t.Run("PT-TR-44 Health con Redis disponible → healthy, redis_connected=true", func(t *testing.T) {
		srv, _ := newTestServer(t)
		res, err := srv.Health(ctx, &pb.HealthRequest{})
		require.NoError(t, err)
		assert.Equal(t, "healthy", res.Status)
		assert.True(t, res.RedisConnected)
	})

	t.Run("PT-TR-45 Redis caído → Health unhealthy y las operaciones devuelven codes.Internal", func(t *testing.T) {
		srv, mr := newTestServer(t)
		mr.Close()
		health, err := srv.Health(ctx, &pb.HealthRequest{})
		require.NoError(t, err)
		assert.Equal(t, "unhealthy", health.Status)
		assert.False(t, health.RedisConnected)

		_, err = srv.Get(ctx, &pb.GetRequest{Key: "k"})
		assert.Equal(t, codes.Internal, status.Code(err))
		_, err = srv.SetWithTTL(ctx, &pb.SetWithTTLRequest{Key: "k", Value: "v", TtlSeconds: 1})
		assert.Equal(t, codes.Internal, status.Code(err))
		_, err = srv.PushBatch(ctx, &pb.PushBatchRequest{Key: "k", Values: []string{"a"}})
		assert.Equal(t, codes.Internal, status.Code(err))
		_, err = srv.Range(ctx, &pb.RangeRequest{Key: "k", Start: 0, Stop: -1})
		assert.Equal(t, codes.Internal, status.Code(err))
	})

	t.Run("PT-TR-46 getEnv → usa la variable si está definida y el valor por defecto si no", func(t *testing.T) {
		t.Setenv("LUM_TEST_VAR", "definida")
		assert.Equal(t, "definida", getEnv("LUM_TEST_VAR", "defecto"))
		assert.Equal(t, "defecto", getEnv("LUM_TEST_VAR_AUSENTE", "defecto"))
	})
}
