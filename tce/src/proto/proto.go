package proto

import (
	"bytes"
	"log"

	"github.com/ipfs/go-cid"
	"github.com/polydawn/refmt/cbor"
)

type MessageContent struct {
	Type uint64
	CID  cid.Cid
}

type Message struct {
	Timestamp uint64
	Username  string
	Content   MessageContent
}

type Request struct {
	Type      uint64
	Timestamp uint64
	Messages  []Message
}

func (m Message) Encode() []byte {
	b, err := cbor.Marshal(m)
	if err != nil {
		log.Fatal(err)
	}

	return b
}

func Decode(b []byte) (Message, error) {
	var msg Message
	err := cbor.Unmarshal(cbor.DecodeOptions{}, b, &msg)
	return msg, err
}
