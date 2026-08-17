package swarm

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"tce/src/proto"
	"time"

	"github.com/ipfs/go-cid"
	"github.com/polydawn/refmt/cbor"
	"go.etcd.io/bbolt"
	"golang.org/x/sync/errgroup"
)

const meta string = "meta"
const blocks string = "blocks"

func (s *Swarm) gather(before int64) (proto.Request, error) {
	messages, err := getBefore(s.db, before, 10)
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

	if err := insertAt(s.db, msg.Timestamp, encoded); err != nil {
		return err
	}

	if err := s.fetchContent(msg); err != nil {
		return err
	}

	return nil
}

func (s *Swarm) getCids() ([]cid.Cid, error) {
	bucket := []byte(blocks)

	var cids []cid.Cid

	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucket)
		if b == nil {
			return nil
		}

		c := b.Cursor()

		for k, _ := c.First(); k != nil; k, _ = c.Next() {
			_, cid, err := cid.CidFromBytes(k)
			if err != nil {
				return err
			}

			cids = append(cids, cid)
		}

		return nil
	})

	return cids, err
}

func (s *Swarm) fetchContent(msg proto.Message) error {
	switch msg.Content.Type {
	case proto.ContentMessage:
		ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()

		block, err := s.swapGetBlock(ctx, msg.Content.CID)
		if err != nil {
			return err
		}

		if err := putBlock(s.db, msg.Content.CID, block); err != nil {
			return err
		}

		cancel()
	case proto.ContentAttachment:
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		cidsRaw, err := s.swapGetBlock(ctx, msg.Content.CID)
		if err != nil {
			return err
		}

		var cids []cid.Cid
		if err := cbor.Unmarshal(cbor.DecodeOptions{}, cidsRaw, &cids); err != nil {
			return err
		}

		g, ctx := errgroup.WithContext(ctx)

		for _, c := range cids {
			g.Go(func() error {
				block, err := s.swapGetBlock(ctx, c)
				if err != nil {
					return err
				}

				return putBlock(s.db, c, block)
			})
		}

		if err := g.Wait(); err != nil {
			return err
		}

		cancel()
	case proto.ContentMedia:
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		cidsRaw, err := s.swapGetBlock(ctx, msg.Content.CID)
		if err != nil {
			return err
		}

		var cids []cid.Cid
		if err := cbor.Unmarshal(cbor.DecodeOptions{}, cidsRaw, &cids); err != nil {
			return err
		}

		g, ctx := errgroup.WithContext(ctx)

		for _, c := range cids {
			g.Go(func() error {
				block, err := s.swapGetBlock(ctx, c)
				if err != nil {
					return err
				}

				return putBlock(s.db, c, block)
			})
		}

		if err := g.Wait(); err != nil {
			return err
		}

		cancel()
	default:
		return errors.New("illegal message")
	}

	return nil
}

func getBefore(
	db *bbolt.DB,
	before int64,
	limit int,
) ([][]byte, error) {
	bucket := []byte(meta)

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
	timestamp int64,
	value []byte,
) error {
	bucket := []byte(meta)

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

func getBlock(db *bbolt.DB, cid cid.Cid) ([]byte, error) {
	bucket := []byte(blocks)

	var block []byte

	err := db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucket)
		if b == nil {
			return fmt.Errorf("bucket %q not found", bucket)
		}

		block = b.Get(cid.Bytes())

		if block == nil {
			return fmt.Errorf("block %q not found", cid.Bytes())
		}

		return nil
	})

	return block, err
}

func putBlock(db *bbolt.DB, cid cid.Cid, block []byte) error {
	bucket := []byte(blocks)

	err := db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucket)
		if b == nil {
			return fmt.Errorf("bucket %q not found", bucket)
		}

		if err := b.Put(cid.Bytes(), block); err != nil {
			return err
		}

		return nil
	})

	return err
}
