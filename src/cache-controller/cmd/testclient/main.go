package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/odritaa/LumInsieme/src/cache-controller/pb"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, "localhost:50051",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("No se pudo conectar: %v", err)
	}
	defer conn.Close()

	client := pb.NewCacheServiceClient(conn)

	// Test Health
	health, err := client.Health(ctx, &pb.HealthRequest{})
	if err != nil {
		log.Fatalf("Health failed: %v", err)
	}
	fmt.Printf("Health: %s (Redis: %v)\n", health.Status, health.RedisConnected)

	// Test Set
	_, err = client.Set(ctx, &pb.SetRequest{Key: "test:greeting", Value: "Hola gRPC"})
	if err != nil {
		log.Fatalf("Set failed: %v", err)
	}
	fmt.Println("Set: OK")

	// Test Get
	get, err := client.Get(ctx, &pb.GetRequest{Key: "test:greeting"})
	if err != nil {
		log.Fatalf("Get failed: %v", err)
	}
	fmt.Printf("Get: %s (found: %v)\n", get.Value, get.Found)

	// Test Delete
	del, err := client.Delete(ctx, &pb.DeleteRequest{Key: "test:greeting"})
	if err != nil {
		log.Fatalf("Delete failed: %v", err)
	}
	fmt.Printf("Delete: %v\n", del.Deleted)

	// Test Push + Range (list)
	_, err = client.Push(ctx, &pb.PushRequest{Key: "test:list", Value: "msg1"})
	if err != nil {
		log.Fatalf("Push failed: %v", err)
	}
	_, err = client.Push(ctx, &pb.PushRequest{Key: "test:list", Value: "msg2"})
	if err != nil {
		log.Fatalf("Push failed: %v", err)
	}
	rangeRes, err := client.Range(ctx, &pb.RangeRequest{Key: "test:list", Start: 0, Stop: -1})
	if err != nil {
		log.Fatalf("Range failed: %v", err)
	}
	fmt.Printf("Range: %v\n", rangeRes.Values)

	// Cleanup
	client.Delete(ctx, &pb.DeleteRequest{Key: "test:list"})

	// Test PushBatch
	_, err = client.PushBatch(ctx, &pb.PushBatchRequest{
		Key:        "test:batch",
		Values:     []string{"batch1", "batch2", "batch3"},
		TtlSeconds: 259200,
	})
	if err != nil {
		log.Fatalf("PushBatch failed: %v", err)
	}
	rangeRes, err = client.Range(ctx, &pb.RangeRequest{Key: "test:batch", Start: 0, Stop: -1})
	if err != nil {
		log.Fatalf("Range failed: %v", err)
	}
	fmt.Printf("PushBatch Range: %v\n", rangeRes.Values)

	// Cleanup batch
	client.Delete(ctx, &pb.DeleteRequest{Key: "test:batch"})

	fmt.Println("\nTodos los tests pasaron!")
}
