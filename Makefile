.PHONY: build
build:
	mkdir -p bin
	cd tcr && cargo b --release
	cp tcr/target/release/tcr* bin
	rm -f bin/*.d
	rm -f bin/*.pdb
	cd tce && make build
	cp tce/bin/* bin

.PHONY: install
install: build
	sudo cp tcr/target/release/tcr /usr/local/bin
	sudo cp tce/bin/tce /usr/local/bin

.PHONY: check
check:
	cd tce && make check
	cd tcr && cargo clippy

.PHONY: clean
clean:
	cd tcr && rm -rf target
	cd tce && rm -rf bin
	rm -rf bin
