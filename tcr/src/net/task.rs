use crate::{
    config::Config,
    net::behaviour::{Behaviour, BehaviourEvent},
};
use color_eyre::eyre::bail;
use libp2p::{
    SwarmBuilder,
    futures::StreamExt,
    identify,
    kad::{self, store::RecordStore},
    multiaddr::Protocol,
    noise,
    swarm::SwarmEvent,
    upnp, yamux,
};

pub async fn task(config: Config) -> color_eyre::Result<()> {
    let identity = config.identity()?;

    let mut swarm = SwarmBuilder::with_existing_identity(identity)
        .with_tokio()
        .with_websocket(noise::Config::new, yamux::Config::default)
        .await?
        .with_behaviour(Behaviour::new)?
        .build();

    swarm.behaviour_mut().kad.set_mode(Some(kad::Mode::Server));

    for addr in config.listen_addrs {
        swarm.listen_on(addr)?;
    }

    for addr in config.external_addrs {
        swarm.add_external_address(addr);
    }

    for mut addr in config.bootstrap_addrs {
        let Some(Protocol::P2p(id)) = addr.pop() else {
            bail!("Bootstrap address must end in \"/p2p/*\"");
        };

        swarm.behaviour_mut().kad.add_address(&id, addr);
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
            SwarmEvent::Behaviour(BehaviourEvent::Kad(kad::Event::InboundRequest {
                request: kad::InboundRequest::AddProvider { record: Some(p) },
            })) => {
                let key = p.key.as_ref();

                if key.len() <= 80 && multihash::Multihash::<64>::from_bytes(key).is_ok() {
                    if let Err(e) = swarm
                        .behaviour_mut()
                        .kad
                        .store_mut()
                        .add_provider(p.clone())
                    {
                        tracing::warn!("Failed to add provider record: {}", e);
                    } else {
                        tracing::trace!("Added provider record: {:?}", p);
                    }
                } else {
                    tracing::trace!("Rejecting invalid provider record.");
                }
            }
            SwarmEvent::Behaviour(BehaviourEvent::Kad(k)) => {
                tracing::trace!("Kad event: {:?}", k);
            }
            SwarmEvent::Behaviour(BehaviourEvent::Identify(identify::Event::Received {
                peer_id,
                info,
                ..
            })) => {
                tracing::trace!("Received identify from {}: {:?}", peer_id, info);

                for addr in info.listen_addrs {
                    swarm.behaviour_mut().kad.add_address(&peer_id, addr);
                }
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
            SwarmEvent::Behaviour(BehaviourEvent::Autonat(a)) => {
                tracing::trace!("Autonat event: {:?}", a);
            }
            ev => tracing::trace!("Swarm event: {:?}", ev),
        }
    }
}
