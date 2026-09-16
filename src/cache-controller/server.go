package main

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/odritaa/LumInsieme/src/cache-controller/pb"
)

type cacheServer struct {
	pb.UnimplementedCacheServiceServer
	rdb *redis.Client
}

func newCacheServer(rdb *redis.Client) *cacheServer {
	return &cacheServer{rdb: rdb}
}

// Basic key-value operations

func (s *cacheServer) Get(ctx context.Context, req *pb.GetRequest) (*pb.GetResponse, error) {
	val, err := s.rdb.Get(ctx, req.Key).Result()
	if err == redis.Nil {
		return &pb.GetResponse{Found: false}, nil
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis GET failed: %v", err)
	}
	return &pb.GetResponse{Value: val, Found: true}, nil
}

func (s *cacheServer) Set(ctx context.Context, req *pb.SetRequest) (*pb.SetResponse, error) {
	err := s.rdb.Set(ctx, req.Key, req.Value, 0).Err()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis SET failed: %v", err)
	}
	return &pb.SetResponse{Ok: true}, nil
}

func (s *cacheServer) Delete(ctx context.Context, req *pb.DeleteRequest) (*pb.DeleteResponse, error) {
	n, err := s.rdb.Del(ctx, req.Key).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis DEL failed: %v", err)
	}
	return &pb.DeleteResponse{Deleted: n > 0}, nil
}

func (s *cacheServer) Exists(ctx context.Context, req *pb.ExistsRequest) (*pb.ExistsResponse, error) {
	n, err := s.rdb.Exists(ctx, req.Key).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis EXISTS failed: %v", err)
	}
	return &pb.ExistsResponse{Exists: n > 0}, nil
}

// TTL operations

func (s *cacheServer) SetTTL(ctx context.Context, req *pb.SetTTLRequest) (*pb.SetTTLResponse, error) {
	ttl := time.Duration(req.TtlSeconds) * time.Second
	err := s.rdb.Expire(ctx, req.Key, ttl).Err()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis EXPIRE failed: %v", err)
	}
	return &pb.SetTTLResponse{Ok: true}, nil
}

func (s *cacheServer) GetTTL(ctx context.Context, req *pb.GetTTLRequest) (*pb.GetTTLResponse, error) {
	ttl, err := s.rdb.TTL(ctx, req.Key).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis TTL failed: %v", err)
	}
	return &pb.GetTTLResponse{TtlSeconds: int64(ttl.Seconds())}, nil
}

func (s *cacheServer) SetWithTTL(ctx context.Context, req *pb.SetWithTTLRequest) (*pb.SetWithTTLResponse, error) {
	ttl := time.Duration(req.TtlSeconds) * time.Second
	err := s.rdb.Set(ctx, req.Key, req.Value, ttl).Err()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis SET with TTL failed: %v", err)
	}
	return &pb.SetWithTTLResponse{Ok: true}, nil
}

// List operations

func (s *cacheServer) Push(ctx context.Context, req *pb.PushRequest) (*pb.PushResponse, error) {
	n, err := s.rdb.RPush(ctx, req.Key, req.Value).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis RPUSH failed: %v", err)
	}
	return &pb.PushResponse{Length: n}, nil
}

func (s *cacheServer) PushBatch(ctx context.Context, req *pb.PushBatchRequest) (*pb.PushBatchResponse, error) {
	if len(req.Values) == 0 {
		return &pb.PushBatchResponse{Length: 0}, nil
	}
	pipe := s.rdb.Pipeline()
	pipe.RPush(ctx, req.Key, req.Values)
	if req.TtlSeconds > 0 {
		ttl := time.Duration(req.TtlSeconds) * time.Second
		pipe.Expire(ctx, req.Key, ttl)
	}
	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis PushBatch failed: %v", err)
	}
	length, err := s.rdb.LLen(ctx, req.Key).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis LLEN failed: %v", err)
	}
	return &pb.PushBatchResponse{Length: length}, nil
}

func (s *cacheServer) Range(ctx context.Context, req *pb.RangeRequest) (*pb.RangeResponse, error) {
	vals, err := s.rdb.LRange(ctx, req.Key, req.Start, req.Stop).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis LRANGE failed: %v", err)
	}
	return &pb.RangeResponse{Values: vals}, nil
}

// Hash operations

func (s *cacheServer) HSet(ctx context.Context, req *pb.HSetRequest) (*pb.HSetResponse, error) {
	err := s.rdb.HSet(ctx, req.Key, req.Field, req.Value).Err()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis HSET failed: %v", err)
	}
	return &pb.HSetResponse{Ok: true}, nil
}

func (s *cacheServer) HGet(ctx context.Context, req *pb.HGetRequest) (*pb.HGetResponse, error) {
	val, err := s.rdb.HGet(ctx, req.Key, req.Field).Result()
	if err == redis.Nil {
		return &pb.HGetResponse{Found: false}, nil
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis HGET failed: %v", err)
	}
	return &pb.HGetResponse{Value: val, Found: true}, nil
}

func (s *cacheServer) HGetAll(ctx context.Context, req *pb.HGetAllRequest) (*pb.HGetAllResponse, error) {
	vals, err := s.rdb.HGetAll(ctx, req.Key).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis HGETALL failed: %v", err)
	}
	return &pb.HGetAllResponse{Fields: vals}, nil
}

func (s *cacheServer) HDel(ctx context.Context, req *pb.HDelRequest) (*pb.HDelResponse, error) {
	n, err := s.rdb.HDel(ctx, req.Key, req.Field).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis HDEL failed: %v", err)
	}
	return &pb.HDelResponse{Deleted: n > 0}, nil
}

// Pub/Sub

func (s *cacheServer) Publish(ctx context.Context, req *pb.PublishRequest) (*pb.PublishResponse, error) {
	n, err := s.rdb.Publish(ctx, req.Channel, req.Message).Result()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "redis PUBLISH failed: %v", err)
	}
	return &pb.PublishResponse{Subscribers: n}, nil
}

func (s *cacheServer) Subscribe(req *pb.SubscribeRequest, stream grpc.ServerStreamingServer[pb.SubscribeResponse]) error {
	ctx := stream.Context()
	pubsub := s.rdb.Subscribe(ctx, req.Channel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg, ok := <-ch:
			if !ok {
				return fmt.Errorf("subscription channel closed")
			}
			if err := stream.Send(&pb.SubscribeResponse{
				Channel: msg.Channel,
				Message: msg.Payload,
			}); err != nil {
				return err
			}
		}
	}
}

// Health check

func (s *cacheServer) Health(ctx context.Context, req *pb.HealthRequest) (*pb.HealthResponse, error) {
	_, err := s.rdb.Ping(ctx).Result()
	if err != nil {
		return &pb.HealthResponse{
			Status:         "unhealthy",
			RedisConnected: false,
		}, nil
	}
	return &pb.HealthResponse{
		Status:         "healthy",
		RedisConnected: true,
	}, nil
}
