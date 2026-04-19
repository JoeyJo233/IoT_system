package com.example.producer.simulator;

import com.example.producer.model.SensorData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import jakarta.annotation.PreDestroy;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

/**
 * IoT sensor simulator. Each sensor runs on its own schedule; the simulator
 * can be started, stopped, and inspected at runtime via
 * {@link com.example.producer.controller.SimulationController}.
 */
@Slf4j
@Service
public class SensorSimulator {

    private final KafkaTemplate<String, SensorData> kafkaTemplate;
    private final ScheduledExecutorService scheduler;
    private final String topic;

    /** Canonical ordered list of sensors this simulator knows about. */
    private final List<SensorSpec> specs = List.of(
            new SensorSpec("sensor-temp-001", "TEMPERATURE", 10_000, "°C", 15.0, 35.0, "warehouse-A"),
            new SensorSpec("sensor-temp-002", "TEMPERATURE", 10_000, "°C", 15.0, 35.0, "warehouse-B"),
            new SensorSpec("sensor-humi-001", "HUMIDITY",    5_000, "%",  30.0, 80.0, "warehouse-A"),
            new SensorSpec("sensor-humi-002", "HUMIDITY",    5_000, "%",  30.0, 80.0, "warehouse-B"),
            new SensorSpec("sensor-pres-001", "PRESSURE",    2_000, "hPa", 980.0, 1050.0, "pipeline-1"),
            new SensorSpec("sensor-pres-002", "PRESSURE",    2_000, "hPa", 980.0, 1050.0, "pipeline-2"),
            new SensorSpec("sensor-vibr-001", "VIBRATION",     500, "mm/s", 0.0, 10.0, "machine-1"),
            new SensorSpec("sensor-vibr-002", "VIBRATION",     500, "mm/s", 0.0, 10.0, "machine-2")
    );

    /** id -> live task. Presence of a key means the sensor is running. */
    private final Map<String, ScheduledFuture<?>> running = new ConcurrentHashMap<>();

    public SensorSimulator(KafkaTemplate<String, SensorData> kafkaTemplate,
                           @Value("${app.kafka.topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
        this.scheduler = Executors.newScheduledThreadPool(10);
    }

    // Wait for full context startup (Kafka connection, etc.) before emitting.
    @EventListener(ApplicationReadyEvent.class)
    public void startSensors() {
        log.info("Starting all sensors on application ready");
        startAll();
    }

    // ------------------------------------------------------------------
    // Public control surface
    // ------------------------------------------------------------------

    public List<SensorSpec> specs() {
        return specs;
    }

    public boolean isRunning(String sensorId) {
        return running.containsKey(sensorId);
    }

    public boolean anyRunning() {
        return !running.isEmpty();
    }

    public Optional<SensorSpec> findSpec(String sensorId) {
        return specs.stream().filter(s -> s.id().equals(sensorId)).findFirst();
    }

    /** Stop everything; idempotent. */
    public synchronized void stopAll() {
        log.info("Stopping all sensors");
        // copy to avoid ConcurrentModificationException
        for (String id : running.keySet().toArray(new String[0])) {
            cancelTask(id);
        }
    }

    /** Start all known sensors; idempotent per sensor. */
    public synchronized void startAll() {
        for (SensorSpec spec : specs) {
            if (!running.containsKey(spec.id())) {
                schedule(spec);
            }
        }
    }

    /** Start one sensor by id. Returns false if the id is unknown. */
    public synchronized boolean startOne(String sensorId) {
        Optional<SensorSpec> spec = findSpec(sensorId);
        if (spec.isEmpty()) return false;
        if (!running.containsKey(sensorId)) {
            schedule(spec.get());
        }
        return true;
    }

    /** Stop one sensor by id. Returns false if the id is unknown. */
    public synchronized boolean stopOne(String sensorId) {
        if (findSpec(sensorId).isEmpty()) return false;
        cancelTask(sensorId);
        return true;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private void schedule(SensorSpec spec) {
        // Random initial delay to avoid thundering herd
        long initialDelay = ThreadLocalRandom.current().nextLong(0, 1000);

        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> {
            try {
                SensorData data = new SensorData();
                data.setSensorId(spec.id());
                data.setSensorType(spec.type());
                data.setValue(ThreadLocalRandom.current().nextDouble(spec.minValue(), spec.maxValue()));
                data.setUnit(spec.unit());
                data.setTimestamp(System.currentTimeMillis());
                data.setLocation(spec.location());

                kafkaTemplate.send(topic, spec.id(), data)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                log.error("[{}] send failed", spec.id(), ex);
                            } else {
                                log.debug("[{}] {} sent: {} {} @ partition={} offset={}",
                                        spec.id(), Instant.ofEpochMilli(data.getTimestamp()),
                                        String.format("%.2f", data.getValue()), data.getUnit(),
                                        result.getRecordMetadata().partition(),
                                        result.getRecordMetadata().offset());
                            }
                        });

            } catch (Exception e) {
                log.error("[{}] sampling error", spec.id(), e);
            }

        }, initialDelay, spec.intervalMs(), TimeUnit.MILLISECONDS);

        running.put(spec.id(), task);
        log.info("Started sensor {} (interval={}ms)", spec.id(), spec.intervalMs());
    }

    private void cancelTask(String sensorId) {
        ScheduledFuture<?> task = running.remove(sensorId);
        if (task != null) {
            task.cancel(false);
            log.info("Stopped sensor {}", sensorId);
        }
    }

    /** Effective rate across currently running sensors (messages per second). */
    public double currentRate() {
        return running.keySet().stream()
                .map(this::findSpec)
                .flatMap(Optional::stream)
                .mapToDouble(s -> 1000.0 / s.intervalMs())
                .sum();
    }

    /** Immutable snapshot of running ids. */
    public List<String> runningIds() {
        return Collections.unmodifiableList(running.keySet().stream().sorted().toList());
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down simulator scheduler...");
        stopAll();
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        log.info("Simulator scheduler stopped");
    }
}
