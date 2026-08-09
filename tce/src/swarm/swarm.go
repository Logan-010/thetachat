package swarm

import (
	"context"
	"log"
	"tce/src/config"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	dht "github.com/libp2p/go-libp2p-kad-dht"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"
	webrtc "github.com/libp2p/go-libp2p/p2p/transport/webrtc"
	"github.com/libp2p/go-libp2p/p2p/transport/websocket"
	"github.com/multiformats/go-multiaddr"
)

type Swarm struct {
	host host.Host
	dht  *dht.IpfsDHT
}

func (s *Swarm) Id() peer.ID {
	return s.host.ID()
}

func (s *Swarm) Close() {
	s.dht.Close()
	s.host.Close()
}

func New(config config.Config) (*Swarm, error) {
	i, err := config.Keypair()
	if err != nil {
		return nil, err
	}

	h, err := libp2p.New(libp2p.Transport(webrtc.New), libp2p.Transport(websocket.New), libp2p.Identity(i), libp2p.ListenAddrStrings(config.ListenAddrs...), libp2p.AddrsFactory(func(allAddrs []multiaddr.Multiaddr) []multiaddr.Multiaddr {
		addrs := make([]multiaddr.Multiaddr, 0)

		for _, addr := range config.ExternalAddrs {
			a, err := multiaddr.NewMultiaddr(addr)
			if err != nil {
				log.Fatal(err)
			}

			addrs = append(addrs, a)
		}

		return append(allAddrs, addrs...)
	}))
	if err != nil {
		return nil, err
	}

	d, err := dht.New(h, dht.Mode(dht.ModeServer))
	if err != nil {
		return nil, err
	}

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

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		if err := h.Connect(ctx, info); err != nil {
			return nil, err
		}

		d.Host().Peerstore().AddAddr(id, a, peerstore.PermanentAddrTTL)
	}

	if len(config.BootstrapAddrs) != 0 {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		if err := d.Bootstrap(ctx); err != nil {
			return nil, err
		}
	}

	return &Swarm{h, d}, nil
}
