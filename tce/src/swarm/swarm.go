package swarm

import (
	"tce/src/config"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	webrtc "github.com/libp2p/go-libp2p/p2p/transport/webrtc"
	"github.com/libp2p/go-libp2p/p2p/transport/websocket"
)

func New(config config.Config) (host.Host, error) {
	i, err := config.Keypair()
	if err != nil {
		return nil, err
	}

	h, err := libp2p.New(libp2p.Transport(webrtc.New), libp2p.Transport(websocket.New), libp2p.Identity(i), libp2p.ListenAddrStrings(config.ListenAddrs...))
	if err != nil {
		return nil, err
	}

	return h, nil
}
