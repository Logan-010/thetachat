{
  description = "Thetachat Flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, fenix, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system} fenix.packages.${system});
    in
    {
      packages = forAllSystems (
        pkgs: fenixPkgs: {

          tce = pkgs.buildGoModule {
            pname = "tce";
            version = "0.1.0";

            src = ./tce;

            vendorHash = "sha256-u48i8723EmfYutK7U1pctnmexAgNEWfBMsF0W/b1NNw=";

            ldflags = [
              "-s"
              "-w"
            ];

            subPackages = [ "src" ];

            postInstall = ''
              mv $out/bin/src $out/bin/tce
            '';
          };

          tcr =
            let
              rustPlatform = pkgs.makeRustPlatform {
                cargo = fenixPkgs.complete.toolchain;
                rustc = fenixPkgs.complete.toolchain;
              };
            in
            rustPlatform.buildRustPackage {
              pname = "tcr";
              version = "0.1.0";

              src = ./tcr;

              cargoLock = {
                lockFile = ./tcr/Cargo.lock;
              };

              installPhase = ''
                mkdir -p $out/bin
                install -Dm755 target/${pkgs.stdenv.hostPlatform.rust.rustcTarget}/release/tcr $out/bin/tcr
              '';
            };
        }
      );

      devShells = forAllSystems (
        pkgs: fenixPkgs: {
          default = pkgs.mkShell {
            packages = with pkgs; [
              # Nightly Rust
              fenixPkgs.complete.toolchain

              # LLVM / LLDB
              llvmPackages.llvm
              llvmPackages.lldb

              # Go
              go
              gopls
              golangci-lint
              golangci-lint-langserver
              delve

              # JavaScript / TypeScript
              bun
              typescript
              typescript-language-server

              # Development tools
              pkg-config
              openssl
              git
              gnumake
            ];
          };
        }
      );
    };
}
