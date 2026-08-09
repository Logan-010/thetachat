package swarm

import (
	"tce/src/config"

	libp2p "github.com/libp2p/go-libp2p"
	dht "github.com/libp2p/go-libp2p-kad-dht"
	"github.com/libp2p/go-libp2p/core/host"
	webrtc "github.com/libp2p/go-libp2p/p2p/transport/webrtc"
	"github.com/libp2p/go-libp2p/p2p/transport/websocket"
)

type Swarm struct {
	host host.Host
	dht  *dht.IpfsDHT
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

	h, err := libp2p.New(libp2p.Transport(webrtc.New), libp2p.Transport(websocket.New), libp2p.Identity(i), libp2p.ListenAddrStrings(config.ListenAddrs...))
	if err != nil {
		return nil, err
	}

	d, err := dht.New(h, dht.Mode(dht.ModeServer))
	if err != nil {
		return nil, err
	}

	return &Swarm{h, d}, nil
}
