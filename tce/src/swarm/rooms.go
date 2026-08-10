package swarm

import (
	"context"
	"errors"
	"log"
	"time"

	pubsub "github.com/libp2p/go-libp2p-pubsub"
	drouting "github.com/libp2p/go-libp2p/p2p/discovery/routing"
	dutil "github.com/libp2p/go-libp2p/p2p/discovery/util"
)

func (s *Swarm) handleMessage(msg *pubsub.Message) error {
	return errors.New("unimplemented")
}

func (s *Swarm) discoverPeers(ctx context.Context, name string) {
	routingDiscovery := drouting.NewRoutingDiscovery(s.dht)
	dutil.Advertise(ctx, routingDiscovery, name)

	peerChan, err := routingDiscovery.FindPeers(ctx, name)
	if err != nil {
		log.Printf("Failed to discover peers for \"%s\": %s", name, err)
		return
	}

	for peer := range peerChan {
		if peer.ID == s.host.ID() {
			continue
		}

		c, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		if err := s.host.Connect(c, peer); err != nil {
			log.Printf("Failed to connect to peer \"%s\": %s", peer.ID.String(), err)
			continue
		}

		cancel()

		log.Printf("Connected to \"%s\"\n", peer.ID.String())
	}
}

func (s *Swarm) JoinRoom(name string) error {
	log.Printf("Joining room \"%s\"\n", name)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go s.discoverPeers(ctx, name)

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
