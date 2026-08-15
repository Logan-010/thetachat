{
  description = "Thetachat Flake";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAllSystems (pkgs: {
        tce = pkgs.stdenv.mkDerivation {
          pname = "tce";
          version = "0.1.0";

          src = ./.;

          nativeBuildInputs = with pkgs; [
            gnumake
          ];

          buildPhase = ''
            make
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp bin/tce $out/bin/tce
          '';
        };

        tcr = pkgs.stdenv.mkDerivation {
          pname = "tcr";
          version = "0.1.0";

          src = ./.;

          nativeBuildInputs = with pkgs; [
            gnumake
          ];

          buildPhase = ''
            make
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp bin/tcr $out/bin/tcr
          '';
        };
      });

      devShells = forAllSystems (
        pkgs:
        let
          rustSrc = pkgs.rustPlatform.rustLibSrc;
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              # Rust
              rustc
              cargo
              rust-analyzer
              rustfmt
              clippy

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

            RUST_SRC_PATH = "${rustSrc}";
          };
        }
      );
    };
}
