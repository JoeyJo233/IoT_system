# IoT Sensor Data Integration System

A high-throughput IoT sensor data pipeline built with a **Producer/Consumer microservices architecture** in Java (Spring Boot). The system ingests sensor readings via Apache Kafka, caches hot data in Redis, and persists to MongoDB — designed to remain responsive during traffic spikes and database slowdowns.

## Architecture

```
[Producer Service]
  temp x2     (10s)
  humidity x2  (5s)    ──►  [Kafka]  ──►  [Consumer Service]  ──►  [MongoDB]
  pressure x2  (2s)                              │                      │
  vibration x2 (500ms)                       [Redis Cache]              │
                                                  │                     │
                                             [REST API] ◄───────────────┘
```

- **Producer**: 8 independent sensor threads push JSON events to the `iot-sensor-data` Kafka topic
- **Kafka**: decouples ingestion from storage, buffering events during DB slowdowns
- **Consumer**: reads from Kafka, writes to MongoDB, caches latest readings in Redis
- **REST API**: exposes query endpoints backed by Redis (hot path) + MongoDB (history)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Java 17 |
| Framework | Spring Boot 4.0.5 |
| Message Broker | Apache Kafka (Confluent 7.5.0) |
| Cache | Redis 7 |
| Database | MongoDB 7 |
| Containerization | Docker / Docker Compose |
| CI/CD | GitHub Actions |
| Image Security | Trivy |
| Container Registry | GitHub Container Registry (GHCR) |

## Project Structure

```
.
├── producer-service/               # Sensor simulator — publishes to Kafka
│   ├── src/main/java/com/example/producer/
│   │   ├── ProducerApplication.java
│   │   ├── model/SensorData.java
│   │   └── simulator/SensorSimulator.java
│   ├── Dockerfile
│   └── pom.xml
│
├── consumer-service/               # Kafka consumer — stores + serves data
│   ├── src/main/java/com/example/consumer/
│   │   ├── ConsumerApplication.java
│   │   ├── model/SensorData.java
│   │   ├── consumer/SensorDataConsumer.java
│   │   ├── repository/SensorDataRepository.java
│   │   └── controller/SensorController.java
│   ├── Dockerfile
│   └── pom.xml
│
├── docker-compose.yml              # Kafka (KRaft), Redis, MongoDB, Producer, Consumer
└── README.md
```

## Getting Started

### Prerequisites

- Docker & Docker Compose

### Run the full system

```bash
docker-compose up --build
```

This starts 5 containers: Kafka (KRaft mode, no Zookeeper), Redis, MongoDB, Producer, Consumer.

### Run services individually (for development)

```bash
# Start infrastructure only
docker-compose up -d kafka redis mongodb

# Run Producer
cd producer-service && ./mvnw spring-boot:run

# Run Consumer
cd consumer-service && ./mvnw spring-boot:run
```

### Dev tools (Mongo Express, Kafka UI, RedisInsight)

Optional web UIs for inspecting the system at runtime. They live under the `tools` Docker Compose profile so they don't start by default.

```bash
docker compose --profile tools up -d mongo-express kafka-ui redis-insight
```

| Tool | URL | Purpose |
|------|-----|---------|
| Mongo Express | http://localhost:8091 | Browse the `iot.sensor_readings` collection, inspect documents, check the `sensorId_ts` / `sensorType_ts` compound indexes |
| Kafka UI | http://localhost:8090 | View brokers, topics (`iot-sensor-data`, `.DLT`), live-stream messages, monitor `iot-consumer-group` lag |
| RedisInsight | http://localhost:5540 | Browse `sensor:latest:*` keys, see TTLs, run commands in the Workbench |

**RedisInsight connection** — add a database with **Host: `redis`** (the Docker service name, not `127.0.0.1`) and **Port: `6379`**. RedisInsight runs inside a container, so `localhost` would point at itself.

**Kafka UI** auto-discovers the cluster via `KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:29092` — no setup needed.

Stop tools only:

```bash
docker compose --profile tools down
```

### Verify messages are flowing

```bash
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic iot-sensor-data \
  --from-beginning
```

## REST API

Base URL: `http://localhost:8082/api/sensors`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/{sensorId}/latest` | Latest reading (Redis cache → MongoDB fallback) |
| GET | `/{sensorId}/history` | Full historical readings from MongoDB |
| GET | `/type/{sensorType}` | All readings by sensor type |

## Sensors

| Sensor ID | Type | Interval | Range | Location |
|-----------|------|----------|-------|----------|
| sensor-temp-001/002 | TEMPERATURE | 10s | 15–35 °C | warehouse-A/B |
| sensor-humi-001/002 | HUMIDITY | 5s | 30–80 % | warehouse-A/B |
| sensor-pres-001/002 | PRESSURE | 2s | 980–1050 hPa | pipeline-1/2 |
| sensor-vibr-001/002 | VIBRATION | 500ms | 0–10 mm/s | machine-1/2 |

## Testing

```bash
# Producer tests
cd producer-service && ./mvnw test

# Consumer tests
cd consumer-service && ./mvnw test
```

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push to `main` and on pull requests:

1. Run unit tests for both services (matrix build)
2. On `main` only: build Docker images via Buildx
3. Scan images with **Trivy** (fails on unfixed CRITICAL/HIGH CVEs)
4. Push versioned + `latest` tags to **GHCR** (`ghcr.io/<owner>/iot-producer-service`, `ghcr.io/<owner>/iot-consumer-service`)

The Spring Boot context-loading test (`ConsumerApplicationTests`) is `@Disabled` in CI because it needs live Kafka/Mongo/Redis; run it locally or wire in Testcontainers to re-enable.

## Notes

> Development observations worth remembering — likely interview topics.

### Kafka listener conflict between local and container environments

**The conflict**

`KAFKA_ADVERTISED_LISTENERS` tells Kafka what address to advertise to clients. When set to `kafka:9092` (container hostname), local Spring Boot can't resolve it. When set to `localhost:9092`, containers can't reach each other because `localhost` inside a container refers to the container itself, not the Kafka container.

**The fix**

Configure two listeners on different ports — one for each network context:

```yaml
KAFKA_LISTENERS: INTERNAL://0.0.0.0:29092,EXTERNAL://0.0.0.0:9092
KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:29092,EXTERNAL://localhost:9092
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT
KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
```

- Local dev connects to `localhost:9092` (EXTERNAL listener)
- Containers connect to `kafka:29092` (INTERNAL listener)

**The standard practice**

Use Spring Boot's environment variable substitution to make `bootstrap-servers` context-aware:

```yaml
kafka:
  bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
```

In `docker-compose.yml`, set `KAFKA_BOOTSTRAP_SERVERS: kafka:29092` for the application containers. Locally, no env var is set, so the default `localhost:9092` is used automatically.

---

## Key Design Decisions

**Why Kafka between Producer and storage?**
Direct synchronous writes to MongoDB under high-frequency sensor data (vibration sensors at 500ms) would block the Producer on DB latency. Kafka acts as a durable buffer — the Producer never waits on storage, and the Consumer applies backpressure independently.

**Why Redis alongside MongoDB?**
Latest readings per sensor are queried far more frequently than historical data. Redis caches the most recent value per `sensorId`, reducing MongoDB read load for the common case.
