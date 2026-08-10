package swarm

import (
	"context"
	"log"
	"tce/src/config"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	dht "github.com/libp2p/go-libp2p-kad-dht"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	webrtc "github.com/libp2p/go-libp2p/p2p/transport/webrtc"
	"github.com/libp2p/go-libp2p/p2p/transport/websocket"
	"github.com/multiformats/go-multiaddr"
	"go.etcd.io/bbolt"
)

type Swarm struct {
	host host.Host
	dht  *dht.IpfsDHT
	ps   *pubsub.PubSub
	db   *bbolt.DB
}

func (s *Swarm) Id() peer.ID {
	return s.host.ID()
}

func (s *Swarm) Bootstrap() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.dht.Bootstrap(ctx); err != nil {
		return err
	}

	return nil
}

func (s *Swarm) Close() {
	s.dht.Close()
	s.host.Close()
	s.db.Close()
}

func New(config config.Config) (*Swarm, error) {
	i, err := config.Keypair()
	if err != nil {
		return nil, err
	}

	bootstrap := make([]peer.AddrInfo, 0)

	for _, addr := range config.BootstrapAddrs {
		a, err := multiaddr.NewMultiaddr(addr)
		if err != nil {
			log.Fatal(err)
		}

		id, err := peer.IDFromP2PAddr(a)
		if err != nil {
			log.Fatal(err)
		}

		info := peer.AddrInfo{
			ID:    id,
			Addrs: []multiaddr.Multiaddr{a},
		}

		bootstrap = append(bootstrap, info)
	}

	h, err := libp2p.New(libp2p.Transport(webrtc.New), libp2p.Transport(websocket.New), libp2p.EnableAutoRelayWithStaticRelays(bootstrap), libp2p.Identity(i), libp2p.ListenAddrStrings(config.ListenAddrs...))
	if err != nil {
		return nil, err
	}

	d, err := dht.New(h, dht.Mode(dht.ModeServer), dht.BootstrapPeers(bootstrap...), dht.ProtocolPrefix("/thetachat"))
	if err != nil {
		return nil, err
	}

	for _, info := range bootstrap {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := h.Connect(ctx, info); err != nil {
			log.Printf("Failed to connect to \"%s\": %s\n", info.ID.String(), err)
		}

		cancel()
	}

	db, err := bbolt.Open(config.Datastore, 0600, nil)
	if err != nil {
		return nil, err
	}

	ps, err := pubsub.NewGossipSub(context.Background(), h)
	if err != nil {
		return nil, err
	}

	return &Swarm{h, d, ps, db}, nil
}
