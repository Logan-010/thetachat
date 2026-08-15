package swarm

import (
	"context"
	"fmt"
	"log"
	"sync"
	"tce/src/config"
	"time"

	"github.com/ipfs/boxo/bitswap"
	"github.com/ipfs/boxo/blockstore"
	"github.com/ipfs/go-ds-flatfs"
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
	config config.Config
	host   host.Host
	dht    *dht.IpfsDHT
	bs     *bitswap.Bitswap
	ps     *pubsub.PubSub
	db     *bbolt.DB
}

func (s *Swarm) Id() peer.ID {
	return s.host.ID()
}

func (s *Swarm) Bootstrap() error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	for s.dht.RoutingTable().Size() == 0 {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(50 * time.Millisecond):
		}
	}

	return s.dht.Bootstrap(ctx)
}

func (s *Swarm) Close() {
	s.bs.Close()
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

	for _, addr := range config.Instances {
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

	h, err := libp2p.New(libp2p.Transport(webrtc.New), libp2p.Ping(true), libp2p.EnableRelay(), libp2p.NATPortMap(), libp2p.Transport(websocket.New), libp2p.EnableAutoRelayWithStaticRelays(bootstrap), libp2p.Identity(i), libp2p.ListenAddrStrings(config.ListenAddrs...))
	if err != nil {
		return nil, err
	}

	d, err := dht.New(h, dht.Mode(dht.ModeServer), dht.BootstrapPeers(bootstrap...), dht.ProtocolPrefix("/thetachat"))
	if err != nil {
		return nil, err
	}

	var wg sync.WaitGroup

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, info := range bootstrap {
		wg.Go(func() {
			if err := h.Connect(ctx, info); err != nil {
				log.Printf("Failed to connect to \"%s\": %s\n", info.ID.String(), err)
			}
		})
	}

	wg.Wait()

	cancel()

	db, err := bbolt.Open(config.Datastore, 0600, nil)
	if err != nil {
		return nil, err
	}

	ps, err := pubsub.NewGossipSub(context.Background(), h)
	if err != nil {
		return nil, err
	}

	shard, err := flatfs.ParseShardFunc("/repo/flatfs/shard/v1/next-to-last/2")
	if err != nil {
		return nil, fmt.Errorf("parse flatfs shard function: %w", err)
	}

	ds, err := flatfs.CreateOrOpen(config.Blockstore, shard, true)
	if err != nil {
		return nil, fmt.Errorf("open blockstore: %w", err)
	}

	bs := blockstore.NewBlockstore(ds)

	b := newBitswap(context.Background(), h, d, bs)

	return &Swarm{config, h, d, b, ps, db}, nil
}
