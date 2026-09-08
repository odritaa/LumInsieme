package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	pb "github.com/odritaa/LumInsieme/src/cache-controller/pb"
)

const port = ":50051"

func main() {
	ctx := context.Background()

	rdb := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("No se pudo conectar a Redis: %v", err)
	}
	fmt.Println("Conectado a Redis correctamente")

	lis, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("No se pudo escuchar en %s: %v", port, err)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterCacheServiceServer(grpcServer, newCacheServer(rdb))
	reflection.Register(grpcServer)

	go func() {
		fmt.Printf("Servidor gRPC escuchando en %s\n", port)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Error al servir gRPC: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("\nApagando servidor...")
	grpcServer.GracefulStop()
	rdb.Close()
	fmt.Println("Servidor detenido correctamente")
}
