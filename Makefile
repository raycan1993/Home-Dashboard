.DEFAULT_GOAL := start

# ── Main targets ──────────────────────────────────────────────────────────────

.PHONY: start stop restart logs update clean

## Build images and start all containers in the background.
start:
	docker compose up -d --build

## Stop all containers (data volume is preserved).
stop:
	docker compose down

## Stop, rebuild, and start again.
restart: stop start

## Tail logs from all containers (Ctrl-C to exit).
logs:
	docker compose logs -f

## Pull the latest code and rebuild.
update:
	git pull --ff-only
	docker compose up -d --build

## Tear down containers AND delete the database volume (full reset).
clean:
	docker compose down -v
