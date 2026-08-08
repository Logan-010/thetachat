package cli

import (
	"flag"
	"log"
	"os"
	"path/filepath"
)

type Args struct {
	ConfigPath string
}

func Init() Args {
	configPath := flag.String("config", "", "Sets config path")

	flag.Parse()

	if *configPath == "" {
		d, err := os.UserHomeDir()
		if err != nil {
			log.Fatal(err)
		}

		*configPath = filepath.Join(d, ".tce", "config.json")
	}

	return Args{*configPath}
}
