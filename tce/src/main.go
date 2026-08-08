package main

import (
	"tce/src/cli"
	"tce/src/config"
	"tce/src/swarm"

	"log"
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

}
