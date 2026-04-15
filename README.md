# IoT Sensor Data Integration System

A high-throughput IoT sensor data pipeline built with a **Producer/Consumer microservices architecture** in Java (Spring Boot). The system ingests sensor readings via Apache Kafka, caches hot data in Redis, and persists to MongoDB — designed to remain responsive during traffic spikes and database slowdowns.

## Architecture

```
[Sensor Simulator]
  temp x2  (10s)
  humidity x2 (5s)       ──►  [Kafka]  ──►  [Consumer Service]  ──►  [MongoDB]
  pressure x2  (2s)              │                                        │
  vibration x2 (500ms)           │                                    [Redis Cache]
                                 │                                        │
                                 └─────────────────────────────────►  [REST API]
```

- **Producer**: 8 independent sensor threads push JSON events to the `iot-sensor-data` Kafka topic at different sampling intervals
- **Kafka**: decouples ingestion from storage, buffering events during DB slowdowns
- **Consumer**: reads from Kafka, writes to MongoDB, caches recent readings in Redis
- **REST API**: exposes sensor data query endpoints backed by Redis + MongoDB

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Java 17 |
| Framework | Spring Boot 4.0.2 |
| Message Broker | Apache Kafka (Confluent 7.5.0) |
| Cache | Redis |
| Database | MongoDB |
| Containerization | Docker / Docker Compose |
| CI/CD | GitHub Actions |
| Image Security | Trivy |
| Container Registry | GitHub Container Registry (GHCR) |

## Getting Started

### Prerequisites

- Java 17+
- Maven 3.8+
- Docker & Docker Compose

### Run locally

**1. Start infrastructure**

```bash
docker-compose up -d
```

This starts Kafka and Zookeeper. Redis and MongoDB are also defined in the compose file.

**2. Run the application**

```bash
./mvnw spring-boot:run
```

The Producer starts automatically and begins publishing sensor events to Kafka.

**3. Verify messages are flowing**

```bash
# consume from the Kafka topic directly
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic iot-sensor-data \
  --from-beginning
```

### Configuration

All configuration is in `src/main/resources/application.yaml`:

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
  data:
    mongodb:
      uri: mongodb://localhost:27017/iot
  redis:
    host: localhost
    port: 6379
```

## Sensors

| Sensor ID | Type | Interval | Range | Location |
|-----------|------|----------|-------|----------|
| sensor-temp-001/002 | TEMPERATURE | 10s | 15–35 °C | warehouse-A/B |
| sensor-humi-001/002 | HUMIDITY | 5s | 30–80 % | warehouse-A/B |
| sensor-pres-001/002 | PRESSURE | 2s | 980–1050 hPa | pipeline-1/2 |
| sensor-vibr-001/002 | VIBRATION | 500ms | 0–10 mm/s | machine-1/2 |

## Testing

```bash
# Run all tests
./mvnw test

# Unit tests only
./mvnw test -Dtest="**/unit/**"

# Integration tests only
./mvnw test -Dtest="**/Integration/**"
```

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push to `main`:

1. Run unit and integration tests
2. Build Docker image
3. Scan image with **Trivy** for known CVEs
4. Push versioned image to **GHCR** (`ghcr.io/<owner>/iot-sensor-system`)

## Project Structure

```
src/
├── main/java/com/example/demo/
│   ├── DemoApplication.java         # Entry point
│   ├── SensorData.java              # Data model
│   ├── SensorSimulator_new.java     # Producer: 8 sensor threads
│   ├── consumer/                    # Kafka consumer (in progress)
│   ├── repository/                  # MongoDB repositories (in progress)
│   └── controller/                  # REST API endpoints (in progress)
└── test/java/com/example/demo/
    ├── unit/SensorDataTest.java
    └── Integration/SensorSimulatorTest.java
```

## Key Design Decisions

**Why Kafka between Producer and storage?**
Direct synchronous writes to MongoDB under high-frequency sensor data (vibration sensors at 500ms) would block the Producer thread on DB latency. Kafka acts as a durable buffer — the Producer never waits on storage, and the Consumer can apply backpressure independently.

**Why Redis alongside MongoDB?**
Latest readings per sensor are queried far more frequently than historical data. Redis caches the most recent value per `sensorId`, reducing MongoDB read load for the common case.
