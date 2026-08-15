.PHONY: build
build: tce tcr

.PHONY: tce
tce:
	mkdir -p bin
	cd tce && make build
	cp tce/bin/* bin

.PHONY: tcr
tcr:
	mkdir -p bin
	cd tcr && cargo +nightly b --release
	cp tcr/target/release/tcr* bin
	rm -f bin/*.d
	rm -f bin/*.pdb

.PHONY: install
install: build
	sudo cp tcr/target/release/tcr /usr/local/bin
	sudo cp tce/bin/tce /usr/local/bin

.PHONY: check
check:
	cd tce && make check
	cd tcr && cargo clippy
	cd tcc && bun run build

.PHONY: clean
clean:
	cd tcr && rm -rf target
	cd tce && rm -rf bin
	cd tcc && rm -rf dist node_modules
	rm -rf bin
