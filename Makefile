.PHONY: help up up-tools infra tools down stop ps logs logs-producer logs-consumer logs-kafka logs-redis logs-mongo web producer consumer test-producer test-consumer

help:
	@echo "Available targets:"
	@echo "  make up             - Start core services with Docker Compose"
	@echo "  make up-tools       - Start core services plus optional debug tools"
	@echo "  make infra          - Start Kafka, Redis, and MongoDB only"
	@echo "  make tools          - Start only optional debug tools"
	@echo "  make down           - Stop and remove the full Docker Compose stack"
	@echo "  make stop           - Stop running containers without removing them"
	@echo "  make ps             - Show container status"
	@echo "  make logs           - Stream all container logs"
	@echo "  make logs-producer  - Stream producer logs"
	@echo "  make logs-consumer  - Stream consumer logs"
	@echo "  make logs-kafka     - Stream Kafka logs"
	@echo "  make logs-redis     - Stream Redis logs"
	@echo "  make logs-mongo     - Stream MongoDB logs"
	@echo "  make web            - Start the Vite Web UI dev server"
	@echo "  make producer       - Run producer-service locally"
	@echo "  make consumer       - Run consumer-service locally"
	@echo "  make test-producer  - Run producer-service tests"
	@echo "  make test-consumer  - Run consumer-service tests"

up:
	docker compose up -d --build

up-tools:
	docker compose --profile tools up -d --build

infra:
	docker compose up -d kafka redis mongodb

tools:
	docker compose --profile tools up -d mongo-express kafka-ui redis-insight

down:
	docker compose down

stop:
	docker compose stop

ps:
	docker compose ps

logs:
	docker compose logs -f

logs-producer:
	docker compose logs -f producer

logs-consumer:
	docker compose logs -f consumer

logs-kafka:
	docker compose logs -f kafka

logs-redis:
	docker compose logs -f redis

logs-mongo:
	docker compose logs -f mongodb

web:
	cd web-ui && npm run dev

producer:
	cd producer-service && ./mvnw spring-boot:run

consumer:
	cd consumer-service && ./mvnw spring-boot:run

test-producer:
	cd producer-service && ./mvnw test

test-consumer:
	cd consumer-service && ./mvnw test
