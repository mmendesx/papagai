.PHONY: dev prod up down restart logs build install test lint

COMPOSE = docker-compose -f docker-compose.yml
COMPOSE_DEV = $(COMPOSE) -f docker-compose.dev.yml

# Dev: hot-reload with mounted source
dev:
	$(COMPOSE_DEV) up

dev/build:
	$(COMPOSE_DEV) up --build

# Production
prod:
	$(COMPOSE) up -d

prod/build:
	$(COMPOSE) up -d --build

# Infra only (db + redis, app runs locally)
infra:
	$(COMPOSE) up -d db redis

down:
	$(COMPOSE) down

down/v:
	$(COMPOSE) down -v

restart:
	$(COMPOSE_DEV) restart app

logs:
	$(COMPOSE_DEV) logs -f app

# Local dev (no Docker for app)
install:
	npm install

build:
	npm run build

start:
	node dist/main.js

watch:
	npm run start:dev

test:
	npm test

test/e2e:
	npm run test:e2e

test/cov:
	npm run test:cov

lint:
	npm run lint
