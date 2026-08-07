use crate::{
    config::Config,
    net::behaviour::{Behaviour, BehaviourEvent},
};
use libp2p::{
    SwarmBuilder, futures::StreamExt, multiaddr::Protocol, noise, swarm::SwarmEvent, upnp, yamux,
};

pub async fn task(config: Config) -> color_eyre::Result<()> {
    let identity = config.identity()?;

    let mut swarm = SwarmBuilder::with_existing_identity(identity)
        .with_tokio()
        .with_websocket(noise::Config::new, yamux::Config::default)
        .await?
        .with_behaviour(Behaviour::new)?
        .build();

    for addr in config.addrs {
        swarm.listen_on(addr)?;
    }

    for addr in config.external_addrs {
        swarm.add_external_address(addr);
    }

    loop {
        match swarm.select_next_some().await {
            SwarmEvent::NewListenAddr { address, .. } => {
                tracing::info!(
                    "Listening on \"{}\"",
                    address.with(Protocol::P2p(*swarm.local_peer_id()))
                );
            }
            SwarmEvent::Behaviour(BehaviourEvent::Ping(p)) => {
                tracing::trace!("Ping event: {:?}", p);
            }
            SwarmEvent::Behaviour(BehaviourEvent::Relay(r)) => {
                tracing::trace!("Relay event: {:?}", r);
            }
            SwarmEvent::Behaviour(BehaviourEvent::Rendezvous(r)) => {
                tracing::trace!("Rendezvous event: {:?}", r);
            }
            SwarmEvent::Behaviour(BehaviourEvent::Identify(i)) => {
                tracing::trace!("Identify event: {:?}", i);
            }
            SwarmEvent::Behaviour(BehaviourEvent::Upnp(upnp::Event::NewExternalAddr(a))) => {
                tracing::info!("New external address: {}", a);
                swarm.add_external_address(a);
            }
            SwarmEvent::Behaviour(BehaviourEvent::Upnp(upnp::Event::ExpiredExternalAddr(a))) => {
                tracing::warn!("External address expired: {}", a);
                swarm.remove_external_address(&a);
            }
            ev => tracing::trace!("Swarm event: {:?}", ev),
        }
    }
}
