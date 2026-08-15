package swarm

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"tce/src/proto"

	"go.etcd.io/bbolt"
)

const bucket string = "saved"

func (s *Swarm) Gather(before int64) (proto.Request, error) {
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

func (s *Swarm) Put(msg proto.Message) error {
	encoded := msg.Encode()

	return insertAt(s.db, []byte(bucket), msg.Timestamp, encoded)
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
