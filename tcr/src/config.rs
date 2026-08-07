use base64::{Engine, engine::general_purpose::STANDARD};
use libp2p::{Multiaddr, identity::Keypair};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::{fs, io};

#[derive(Serialize, Deserialize)]
pub struct Config {
    identity: String,
    pub addrs: Vec<Multiaddr>,
}

impl Default for Config {
    #[allow(clippy::expect_used)]
    fn default() -> Self {
        let key = Keypair::generate_ed25519();
        let identity = STANDARD.encode(key.to_protobuf_encoding().expect("Valid keypair"));

        Self {
            identity,
            addrs: vec![
                "/ip6/::/tcp/8801/ws".parse().expect("Valid address"),
                "/ip4/0.0.0.0/tcp/8801/ws".parse().expect("Valid address"),
            ],
        }
    }
}

impl Config {
    #[allow(clippy::future_not_send)]
    pub async fn init<P: AsRef<Path>>(from: P) -> io::Result<Self> {
        if fs::try_exists(&from).await? {
            let content = fs::read(from).await?;

            toml::from_slice(&content).map_err(io::Error::other)
        } else {
            let config = Self::default();

            let encoded = toml::to_string_pretty(&config).map_err(io::Error::other)?;

            if let Some(parent) = from.as_ref().parent()
                && !fs::try_exists(parent).await?
            {
                fs::create_dir_all(parent).await?;
            }

            fs::write(from, encoded).await?;

            Ok(config)
        }
    }

    pub fn identity(&self) -> color_eyre::Result<Keypair> {
        let decoded = STANDARD.decode(&self.identity)?;
        let parsed = Keypair::from_protobuf_encoding(&decoded)?;

        Ok(parsed)
    }
}
