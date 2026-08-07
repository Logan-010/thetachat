package config

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"os"

	"github.com/libp2p/go-libp2p/core/crypto"
)

type SaveConfig struct {
	SaveMessages    bool `json:"saveMessages"`
	SaveMedia       bool `json:"saveMedia"`
	SaveAttachments bool `json:"saveAttachments"`
}

type ClientConfig struct {
	Name string `json:"name"`
	SaveConfig
}

type Config struct {
	Identity      string         `json:"identity"`
	ListenAddrs   []string       `json:"listenAddrs"`
	ExternalAddrs []string       `json:"externalAddrs"`
	Rooms         []string       `json:"rooms"`
	ClientConfig  []ClientConfig `json:"clientConfig"`
	DefaultConfig SaveConfig     `json:"defaultConfig"`
}

func (c *Config) Keypair() (crypto.PrivKey, error) {
	r := bytes.NewBuffer([]byte(c.Identity))
	dec := base64.NewDecoder(base64.StdEncoding, r)

	dat, err := io.ReadAll(dec)
	if err != nil {
		return nil, err
	}

	pk, err := crypto.UnmarshalPrivateKey(dat)
	if err != nil {
		return nil, err
	}

	return pk, nil
}

func newConfig() Config {
	pk, _, err := crypto.GenerateEd25519Key(rand.Reader)
	if err != nil {
		log.Fatal(err)
	}

	dat := bytes.NewBuffer(make([]byte, 0))
	enc := base64.NewEncoder(base64.StdEncoding, dat)

	k, err := crypto.MarshalPrivateKey(pk)
	if err != nil {
		log.Fatal(err)
	}

	if _, err := enc.Write(k); err != nil {
		log.Fatal(err)
	}

	return Config{Identity: dat.String()}
}

func Init(path string) (*Config, error) {
	cfg := newConfig()

	if _, err := os.Stat(path); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, err
		} else {
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
