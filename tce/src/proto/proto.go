package proto

import (
	"log"

	"github.com/ipfs/go-cid"
	"github.com/libp2p/go-libp2p/core/protocol"
	"github.com/polydawn/refmt/cbor"
)

const SwapProtocol protocol.ID = "/thetachat/swap/1.0.0"

const (
	ContentMessage = iota
	ContentAttachment
	ContentMedia
)

type MessageContent struct {
	Type int64
	CID  cid.Cid
}

type Message struct {
	Timestamp int64
	Name      string
	Content   MessageContent
}

func (m Message) Encode() []byte {
	b, err := cbor.Marshal(m)
	if err != nil {
		log.Fatal(err)
	}

	return b
}

func DecodeMessage(b []byte) (Message, error) {
	var msg Message
	err := cbor.Unmarshal(cbor.DecodeOptions{}, b, &msg)
	return msg, err
}

const (
	RequestGet     = iota
	RequestMessage = iota
)

type Request struct {
	Type      int64
	Timestamp int64
	Messages  []Message
}

func (m Request) Encode() []byte {
	b, err := cbor.Marshal(m)
	if err != nil {
		log.Fatal(err)
	}

	return b
}

func DecodeRequest(b []byte) (Request, error) {
	var msg Request
	err := cbor.Unmarshal(cbor.DecodeOptions{}, b, &msg)
	return msg, err
}
