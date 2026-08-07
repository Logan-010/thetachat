use clap::Parser;
use std::path::PathBuf;

#[derive(Parser)]
#[command(about = env!("CARGO_PKG_DESCRIPTION"))]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(author = env!("CARGO_PKG_AUTHORS"))]
pub struct Cli {
    /// Custom log level
    #[arg(long, short = 'L', default_value_t = String::from("tcn=info,warn"))]
    pub logging: String,

    /// Custom config path
    #[arg(long, short = 'C')]
    pub config: Option<PathBuf>,
}
