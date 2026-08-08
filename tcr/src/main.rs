#![forbid(unsafe_code)]

mod cli;
mod config;
mod net;

use clap::Parser;
use cli::Cli;
use color_eyre::eyre::ContextCompat;
use config::Config;
use std::env;
use tokio::{select, signal};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;

    let cli = Cli::parse();

    if let Err(e) = tracing_subscriber::registry()
        .with(EnvFilter::new(&cli.logging))
        .with(tracing_subscriber::fmt::layer())
        .try_init()
    {
        eprintln!("Failed to initialize logger: {e}");
    }

    let config_path = match cli.config {
        Some(p) => p,
        None => env::home_dir()
            .context("Expected home directory")?
            .join(".tcr")
            .join("config.toml"),
    };

    tracing::trace!("Loading config from \"{}\"", config_path.display());

    let config = Config::init(config_path).await?;

    tracing::trace!("Config loaded with identity \"{:?}\"", config.identity());

    let swarm_task = net::task(config);
    let exit_signal = signal::ctrl_c();

    tracing::info!("Starting swarm, press ctrl+c to quit...");

    select! {
        exit_res = exit_signal => exit_res?,
        swarm_res = swarm_task => swarm_res?
    }

    tracing::info!("Quitting...");

    Ok(())
}
