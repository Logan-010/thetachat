use libp2p::{identity::Keypair, ping, relay, rendezvous, swarm::NetworkBehaviour};

#[derive(NetworkBehaviour)]
pub struct Behaviour {
    ping: ping::Behaviour,
    relay: relay::Behaviour,
    rendezvous: rendezvous::server::Behaviour,
}

impl Behaviour {
    pub fn new(keypair: &Keypair) -> Self {
        Self {
            ping: ping::Behaviour::new(ping::Config::default()),
            relay: relay::Behaviour::new(keypair.public().to_peer_id(), relay::Config::default()),
            rendezvous: rendezvous::server::Behaviour::new(rendezvous::server::Config::default()),
        }
    }
}
