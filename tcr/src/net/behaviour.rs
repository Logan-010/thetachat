use libp2p::{identify, identity::Keypair, ping, relay, rendezvous, swarm::NetworkBehaviour};

const THETACHAT_PROTO: &str = concat!("/thetachat/relay/", env!("CARGO_PKG_VERSION"));

#[derive(NetworkBehaviour)]
pub struct Behaviour {
    ping: ping::Behaviour,
    relay: relay::Behaviour,
    rendezvous: rendezvous::server::Behaviour,
    identify: identify::Behaviour,
}

impl Behaviour {
    pub fn new(keypair: &Keypair) -> Self {
        Self {
            ping: ping::Behaviour::new(ping::Config::default()),
            relay: relay::Behaviour::new(keypair.public().to_peer_id(), relay::Config::default()),
            rendezvous: rendezvous::server::Behaviour::new(rendezvous::server::Config::default()),
            identify: identify::Behaviour::new(identify::Config::new(
                String::from(THETACHAT_PROTO),
                keypair.public(),
            )),
        }
    }
}
