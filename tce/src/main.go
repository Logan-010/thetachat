package main

import (
	"tce/src/config"

	"log"
)

func main() {
	_, err := config.Init("config.json")
	if err != nil {
		log.Fatal(err)
	}
}
