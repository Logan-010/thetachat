package main

import (
	"tce/src/cli"
	"tce/src/config"
	"tce/src/swarm"

	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	args := cli.Init()

	cfg, err := config.Init(args.ConfigPath)
	if err != nil {
		log.Fatal(err)
	}

	swarm, err := swarm.New(*cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer swarm.Close()

	log.Println("Bootstrapping...")

	if err := swarm.Bootstrap(); err != nil {
		log.Printf("Bootstrap failed (continuing anyway): %s\n", err)
	}

	log.Printf("Started swarm for peer \"%s\", press ctrl+c to quit...\n", swarm.Id().String())

	for _, room := range cfg.Rooms {
		go func() {
			if err := swarm.JoinRoom(room); err != nil {
				log.Printf("Room task failure: %s\n", err)
			}
		}()
	}

	exit := make(chan os.Signal, 1)

	signal.Notify(exit, os.Interrupt, syscall.SIGTERM)

	<-exit

	log.Println("Quitting...")
}
