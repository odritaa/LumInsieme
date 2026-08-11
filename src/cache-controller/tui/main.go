package main

import (
	"fmt"
	"os"

	tea "charm.land/bubbletea/v2"
)

func main() {
	addr := "localhost:50051"
	if envAddr := os.Getenv("GRPC_ADDR"); envAddr != "" {
		addr = envAddr
	}

	p := tea.NewProgram(initialModel(addr))

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
