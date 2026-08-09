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

	log.Printf("Started swarm for peer \"%s\", press ctrl+c to quit...\n", swarm.Id().String())

	exit := make(chan os.Signal, 1)

	signal.Notify(exit, os.Interrupt, syscall.SIGTERM)

	<-exit

	log.Println("Quitting...")
}
