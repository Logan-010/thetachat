use libp2p::{identify, identity::Keypair, kad, ping, relay, swarm::NetworkBehaviour, upnp};

const THETACHAT_PROTO: &str = concat!("/thetachat/relay/", env!("CARGO_PKG_VERSION"));

#[derive(NetworkBehaviour)]
pub struct Behaviour {
    ping: ping::Behaviour,
    relay: relay::Behaviour,
    identify: identify::Behaviour,
    pub(crate) kad: kad::Behaviour<kad::store::MemoryStore>,
    upnp: upnp::tokio::Behaviour,
}

impl Behaviour {
    pub fn new(keypair: &Keypair) -> Self {
        Self {
            ping: ping::Behaviour::new(ping::Config::default()),
            relay: relay::Behaviour::new(keypair.public().to_peer_id(), relay::Config::default()),
            identify: identify::Behaviour::new(identify::Config::new(
                String::from(THETACHAT_PROTO),
                keypair.public(),
            )),
            kad: kad::Behaviour::with_config(
                keypair.public().to_peer_id(),
                kad::store::MemoryStore::new(keypair.public().to_peer_id()),
                kad::Config::default()
                    .set_record_filtering(kad::StoreInserts::FilterBoth)
                    .clone(),
            ),
            upnp: upnp::tokio::Behaviour::default(),
        }
    }
}
