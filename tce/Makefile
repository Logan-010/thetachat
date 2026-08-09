.PHONY: build
build:
	mkdir -p bin
	go build -ldflags="-s -w" -o bin/tce ./src

.PHONY: run
run:
	go run ./src

.PHONY: check
check:
	go vet ./src
