package swarm

import (
	"context"

	"github.com/ipfs/boxo/bitswap"
	"github.com/ipfs/boxo/bitswap/network/bsnet"
	"github.com/ipfs/boxo/blockstore"
	dht "github.com/libp2p/go-libp2p-kad-dht"
	"github.com/libp2p/go-libp2p/core/host"
)

func newBitswap(
	ctx context.Context,
	h host.Host,
	kad *dht.IpfsDHT,
	bstore blockstore.Blockstore,
) *bitswap.Bitswap {
	network := bsnet.NewFromIpfsHost(h)

	return bitswap.New(
		ctx,
		network,
		kad,
		bstore,
	)
}
