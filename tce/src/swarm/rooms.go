package swarm

import (
	"context"
	"log"
	"time"

	"github.com/ipfs/go-cid"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/multiformats/go-multihash"
)

func (s *Swarm) discoverPeers(ctx context.Context, cid cid.Cid) {
	providers := s.dht.FindProvidersAsync(ctx, cid, 0)

	for peer := range providers {
		if peer.ID == s.host.ID() || s.host.Network().Connectedness(peer.ID) == network.Connected {
			continue
		}

		log.Printf("Connecting to \"%s\"\n", peer.ID.String())

		if err := s.host.Connect(ctx, peer); err != nil {
			log.Printf("Failure connecting to \"%s\": %s\n", peer.ID.String(), err)
		}
	}

}

func (s *Swarm) handleMessage(msg *pubsub.Message) error {
	log.Fatal("Unimplemented :(")

	return nil
}

func (s *Swarm) JoinRoom(name string) error {
	log.Printf("Joining room \"%s\"\n", name)

	mh, err := multihash.Sum([]byte(name), multihash.BLAKE3, -1)
	if err != nil {
		return err
	}

	cid := cid.NewCidV1(cid.Raw, mh)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if err := s.dht.Provide(ctx, cid, true); err != nil {
		return err
	}

	cancel()

	topic, err := s.ps.Join(name)
	if err != nil {
		return err
	}
	defer topic.Close()

	sub, err := topic.Subscribe()
	if err != nil {
		return err
	}
	defer sub.Cancel()

	ctx, cancel = context.WithTimeout(context.Background(), 2*time.Minute)
	s.discoverPeers(ctx, cid)
	cancel()

	go func() {
		t := time.NewTicker(time.Minute * 10)
		defer t.Stop()
		for range t.C {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			s.discoverPeers(ctx, cid)
			cancel()
		}
	}()

	for {
		msg, err := sub.Next(context.Background())
		if err != nil {
			log.Printf("Failed to get message from room \"%s\": %s\n", name, err)
			continue
		}

		go func() {
			if err := s.handleMessage(msg); err != nil {
				log.Printf("Failed to handle message: %s\n", err)
			}
		}()

	}

}
