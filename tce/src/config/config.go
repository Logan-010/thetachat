package config

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"os"
	"path/filepath"

	crypto "github.com/libp2p/go-libp2p/core/crypto"
)

type SaveConfig struct {
	SaveMessages    bool `json:"saveMessages"`
	SaveMedia       bool `json:"saveMedia"`
	SaveAttachments bool `json:"saveAttachments"`
}

type Config struct {
	Identity       string                `json:"identity"`
	Datastore      string                `json:"datastore"`
	ListenAddrs    []string              `json:"listenAddrs"`
	BootstrapAddrs []string              `json:"bootstrapAddrs"`
	StunServers    []string              `json:"stunServers"`
	Rooms          []string              `json:"rooms"`
	ClientConfig   map[string]SaveConfig `json:"clientConfig"`
	DefaultConfig  SaveConfig            `json:"defaultConfig"`
}

func (c *Config) Keypair() (crypto.PrivKey, error) {
	dat, err := base64.StdEncoding.DecodeString(c.Identity)
	if err != nil {
		return nil, err
	}

	return crypto.UnmarshalPrivateKey(dat)
}

func newConfig(at string) Config {
	pk, _, err := crypto.GenerateEd25519Key(rand.Reader)
	if err != nil {
		log.Fatal(err)
	}

	dat, err := crypto.MarshalPrivateKey(pk)
	if err != nil {
		log.Fatal(err)
	}

	return Config{
		Identity:  base64.StdEncoding.EncodeToString(dat),
		Datastore: filepath.Join(filepath.Dir(at), "datastore.bin"),
		ListenAddrs: []string{
			"/ip4/0.0.0.0/tcp/8802/ws",
			"/ip6/::/tcp/8802/ws",
			"/ip4/0.0.0.0/udp/8802/webrtc-direct",
			"/ip6/::/udp/8802/webrtc-direct",
		},
	}
}

func Init(path string) (*Config, error) {
	cfg := newConfig(path)

	if _, err := os.Stat(path); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, err
		} else {
			parent := filepath.Dir(path)

			if _, err = os.Stat(parent); err != nil {
				if errors.Is(err, os.ErrNotExist) {
					if err = os.MkdirAll(parent, 0777); err != nil {
						return nil, err
					}
				} else {
					return nil, err
				}
			}

			file, err := os.Create(path)
			if err != nil {
				return nil, err
			}
			defer file.Close()

			dat, err := json.MarshalIndent(cfg, "", "  ")
			if err != nil {
				return nil, err
			}

			if _, err := file.Write(dat); err != nil {
				return nil, err
			}
		}
	} else {
		file, err := os.Open(path)
		if err != nil {
			return nil, err
		}
		defer file.Close()

		dat, err := io.ReadAll(file)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(dat, &cfg); err != nil {
			return nil, err
		}
	}

	return &cfg, nil
}
