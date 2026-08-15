package swarm

import (
	"context"
	"errors"
	"log"
	"tce/src/proto"
	"time"

	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p/core/network"
	drouting "github.com/libp2p/go-libp2p/p2p/discovery/routing"
	dutil "github.com/libp2p/go-libp2p/p2p/discovery/util"
)

func (s *Swarm) handleMessage(topic *pubsub.Topic, msg *pubsub.Message) error {
	user := msg.GetFrom()

	cfg, exists := s.config.ClientConfig[user.String()]
	if !exists {
		cfg = s.config.DefaultConfig
	}

	// If we dont need to save anything skip parsing the message
	if !cfg.SaveAttachments && !cfg.SaveMedia && cfg.SaveMessages {
		return nil
	}

	parsed, err := proto.DecodeRequest(msg.Data)
	if err != nil {
		return err
	}

	switch parsed.Type {
	case proto.RequestGet:
		rq, err := s.Gather(parsed.Timestamp)
		if err != nil {
			return err
		}

		encoded := rq.Encode()

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*20)
		defer cancel()

		topic.Publish(ctx, encoded)

		cancel()
	case proto.RequestMessage:
		for _, msg := range parsed.Messages {
			switch msg.Content.Type {
			case proto.ContentAttachment:
				if !cfg.SaveAttachments {
					continue
				}
			case proto.ContentMedia:
				if !cfg.SaveMedia {
					continue
				}
			case proto.ContentMessage:
				if !cfg.SaveMessages {
					continue
				}

			default:
				continue
			}

			if err := s.Put(msg); err != nil {
				log.Printf("Error putting message into blockstore: %s\n", err)
			}
		}
	default:
		return errors.New("illegal message")
	}

	return nil
}

func (s *Swarm) discoverPeers(ctx context.Context, name string) {
	log.Printf("Starting discovery for %q", name)

	rd := drouting.NewRoutingDiscovery(s.dht)

	log.Printf("Advertising %q", name)
	dutil.Advertise(ctx, rd, name)
	log.Printf("Advertisement initiated for %q", name)

	log.Printf(
		"DHT routing table contains %d peers",
		s.dht.RoutingTable().Size(),
	)

	log.Printf("Finding peers for %q", name)

	peers, err := rd.FindPeers(ctx, name)
	if err != nil {
		log.Printf("FindPeers(%q) failed: %v", name, err)
		return
	}

	for p := range peers {
		log.Printf("Found peer %s at %v", p.ID, p.Addrs)

		if p.ID == s.host.ID() {
			continue
		}

		if s.host.Network().Connectedness(p.ID) == network.Connected {
			continue
		}

		c, cancel := context.WithTimeout(ctx, 10*time.Second)
		err := s.host.Connect(c, p)
		cancel()

		if err != nil {
			log.Printf("Connect %s failed: %v", p.ID, err)
			continue
		}

		log.Printf("Connected to %s", p.ID)
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
			if err := s.handleMessage(topic, msg); err != nil {
				log.Printf("Failed to handle message: %s\n", err)
			}
		}()
	}
}
