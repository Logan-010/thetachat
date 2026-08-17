package swarm

import (
	"context"
	"errors"
	"io"
	"log"
	"tce/src/proto"
	"time"

	"github.com/ipfs/go-cid"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
)

const maxBlockSize = 64 << 20

func (s *Swarm) swapHandler(stream network.Stream) {
	defer stream.Close()

	_, requestedCID, err := cid.CidFromReader(stream)
	if err != nil {
		log.Printf("Failed to read cid from stream: %s\n", err)
		return
	}

	block, err := getBlock(s.db, requestedCID)
	if err != nil {
		log.Printf("Failed to get block: %s\n", err)
		return
	}

	if len(block) > maxBlockSize {
		log.Printf("Block too large: %d bytes\n", len(block))
		return
	}

	if _, err := stream.Write(block); err != nil {
		log.Printf("Failed to send block: %s\n", err)
		return
	}
}

func (s *Swarm) swapGetBlock(ctx context.Context, requestedCID cid.Cid) ([]byte, error) {
	ctx2, cancel := context.WithCancel(ctx)
	defer cancel()

	providers := s.dht.FindProvidersAsync(ctx2, requestedCID, 0)
	block := make(chan []byte, 1)

	for {
		select {
		case b := <-block:
			return b, nil

		case <-ctx.Done():
			return nil, ctx.Err()

		case peerInfo, ok := <-providers:
			if !ok {
				return nil, errors.New("no providers found")
			}

			go func(p peer.AddrInfo) {
				peerCtx, peerCancel := context.WithTimeout(ctx2, 25*time.Second)
				defer peerCancel()

				if s.host.Network().Connectedness(p.ID) != network.Connected {
					if err := s.host.Connect(peerCtx, p); err != nil {
						log.Printf("Failed to connect to peer: %s\n", err)
						return
					}
				}

				stream, err := s.host.NewStream(peerCtx, p.ID, proto.SwapProtocol)
				if err != nil {
					log.Printf("Failed to open stream: %s\n", err)
					return
				}
				defer stream.Close()

				if _, err := stream.Write(requestedCID.Bytes()); err != nil {
					log.Printf("Failed to write to stream: %s\n", err)
					return
				}

				b, err := io.ReadAll(io.LimitReader(stream, maxBlockSize+1))
				if err != nil {
					log.Printf("Failed to read from stream: %s\n", err)
					return
				}

				if len(b) > maxBlockSize {
					log.Printf("Received block too large: %d bytes\n", len(b))
					return
				}

				actualCID, err := requestedCID.Prefix().Sum(b)
				if err != nil {
					log.Printf("Failed to calculate block cid: %s\n", err)
					return
				}

				if !actualCID.Equals(requestedCID) {
					log.Printf("Received block with incorrect cid: expected %s, got %s\n", requestedCID, actualCID)
					return
				}

				select {
				case block <- b:
				case <-ctx2.Done():
				}
			}(peerInfo)
		}
	}
}
