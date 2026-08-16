package swarm

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"tce/src/proto"
	"time"

	"github.com/ipfs/boxo/blockservice"
	"github.com/ipfs/boxo/ipld/merkledag"
	"github.com/ipfs/go-cid"
	"go.etcd.io/bbolt"
)

const bucket string = "saved"

func (s *Swarm) gather(before int64) (proto.Request, error) {
	messages, err := getBefore(s.db, []byte(bucket), before, 10)
	if err != nil {
		return proto.Request{}, err
	}

	decoded := make([]proto.Message, 0)

	for _, msg := range messages {
		dec, err := proto.DecodeMessage(msg)
		if err != nil {
			return proto.Request{}, err
		}

		decoded = append(decoded, dec)
	}

	return proto.Request{Type: proto.RequestMessage, Messages: decoded}, nil
}

func (s *Swarm) put(msg proto.Message) error {
	encoded := msg.Encode()

	if err := insertAt(s.db, []byte(bucket), msg.Timestamp, encoded); err != nil {
		return err
	}

	if err := s.fetchContent(msg); err != nil {
		return err
	}

	return nil
}

func (s *Swarm) fetchContent(msg proto.Message) error {
	switch msg.Content.Type {
	case proto.ContentMessage:
		ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()

		block, err := s.bs.GetBlock(ctx, msg.Content.CID)
		if err != nil {
			return err
		}

		cancel()

		ctx, cancel = context.WithTimeout(context.Background(), time.Second*15)
		defer cancel()

		if err := s.b.Put(ctx, block); err != nil {
			return err
		}

		cancel()
	case proto.ContentAttachment:
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		if err := fetchFile(ctx, msg.Content.CID, s.bls); err != nil {
			return err
		}

		cancel()
	case proto.ContentMedia:
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		if err := fetchFile(ctx, msg.Content.CID, s.bls); err != nil {
			return err
		}

		cancel()
	default:
		return errors.New("illegal message")
	}

	return nil
}

func fetchFile(
	ctx context.Context,
	root cid.Cid,
	blockservice blockservice.BlockService,
) error {
	dagService := merkledag.NewDAGService(blockservice)

	return merkledag.FetchGraph(ctx, root, dagService)
}

func getBefore(
	db *bbolt.DB,
	bucket []byte,
	before int64,
	limit int,
) ([][]byte, error) {
	var results [][]byte

	err := db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucket)
		if b == nil {
			return fmt.Errorf("bucket %q not found", bucket)
		}

		c := b.Cursor()

		k, _ := c.Seek(encodeTimestamp(before))

		if k == nil {
			k, _ = c.Last()
		} else {
			k, _ = c.Prev()
		}

		for k != nil && len(results) < limit {
			v := c.Bucket().Get(k)

			results = append(results, bytes.Clone(v))

			k, _ = c.Prev()
		}

		return nil
	})

	return results, err
}

func insertAt(
	db *bbolt.DB,
	bucket []byte,
	timestamp int64,
	value []byte,
) error {
	return db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucket)
		if b == nil {
			return fmt.Errorf("bucket %q not found", bucket)
		}

		key := encodeTimestamp(timestamp)

		return b.Put(key, value)
	})
}

func encodeTimestamp(ts int64) []byte {
	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], uint64(ts))
	return buf[:]
}
