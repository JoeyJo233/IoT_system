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
import java.util.*;
import java.util.concurrent.*;

/**
 * IoT sensor simulator. Manages a dynamic catalog of sensors — sensors can be
 * added, edited, and deleted at runtime via the REST control surface.
 *
 * Thread safety: the specsMap is guarded by {@code synchronized(this)}.
 * The running map and modelStates maps are ConcurrentHashMap.
 */
@Slf4j
@Service
public class SensorSimulator {

    private final KafkaTemplate<String, SensorData> kafkaTemplate;
    private final ScheduledExecutorService scheduler;
    private final String topic;

    /** Ordered sensor catalog. LinkedHashMap preserves insertion order for stable API responses. */
    private final Map<String, SensorSpec> specsMap = new LinkedHashMap<>();

    /** id → live scheduled task. Presence of a key means the sensor is currently publishing. */
    private final Map<String, ScheduledFuture<?>> running = new ConcurrentHashMap<>();

    /** Per-sensor mutable state for stateful data models (RANDOM_WALK, STEP). */
    private final Map<String, ModelState> modelStates = new ConcurrentHashMap<>();

    public SensorSimulator(KafkaTemplate<String, SensorData> kafkaTemplate,
                           @Value("${app.kafka.topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
        this.scheduler = Executors.newScheduledThreadPool(16);
        seedDefaultSensors();
    }

    private void seedDefaultSensors() {
        List<SensorSpec> defaults = List.of(
            new SensorSpec("sensor-temp-001", "TEMPERATURE", 10_000, "°C", 15.0, 35.0, "warehouse-A", DataModel.RANDOM),
            new SensorSpec("sensor-temp-002", "TEMPERATURE", 10_000, "°C", 15.0, 35.0, "warehouse-B", DataModel.SINE),
            new SensorSpec("sensor-humi-001", "HUMIDITY",    5_000, "%",  30.0, 80.0, "warehouse-A", DataModel.RANDOM),
            new SensorSpec("sensor-humi-002", "HUMIDITY",    5_000, "%",  30.0, 80.0, "warehouse-B", DataModel.RANDOM_WALK),
            new SensorSpec("sensor-pres-001", "PRESSURE",    2_000, "hPa", 980.0, 1050.0, "pipeline-1", DataModel.RANDOM),
            new SensorSpec("sensor-pres-002", "PRESSURE",    2_000, "hPa", 980.0, 1050.0, "pipeline-2", DataModel.SAWTOOTH),
            new SensorSpec("sensor-vibr-001", "VIBRATION",     500, "mm/s", 0.0, 10.0, "machine-1", DataModel.RANDOM),
            new SensorSpec("sensor-vibr-002", "VIBRATION",     500, "mm/s", 0.0, 10.0, "machine-2", DataModel.STEP)
        );
        for (SensorSpec spec : defaults) {
            specsMap.put(spec.id(), spec);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void startSensors() {
        log.info("Starting all sensors on application ready");
        startAll();
    }

    // ------------------------------------------------------------------
    // Read-only queries
    // ------------------------------------------------------------------

    public synchronized List<SensorSpec> specs() {
        return new ArrayList<>(specsMap.values());
    }

    public synchronized Optional<SensorSpec> findSpec(String sensorId) {
        return Optional.ofNullable(specsMap.get(sensorId));
    }

    public boolean isRunning(String sensorId) {
        return running.containsKey(sensorId);
    }

    public boolean anyRunning() {
        return !running.isEmpty();
    }

    public List<String> runningIds() {
        return Collections.unmodifiableList(running.keySet().stream().sorted().toList());
    }

    public double currentRate() {
        return running.keySet().stream()
                .map(id -> specsMap.get(id))
                .filter(Objects::nonNull)
                .mapToDouble(s -> 1000.0 / s.intervalMs())
                .sum();
    }

    // ------------------------------------------------------------------
    // Global control
    // ------------------------------------------------------------------

    public synchronized void stopAll() {
        log.info("Stopping all sensors");
        for (String id : running.keySet().toArray(new String[0])) {
            cancelTask(id);
        }
    }

    public synchronized void startAll() {
        for (String id : specsMap.keySet()) {
            if (!running.containsKey(id)) {
                schedule(specsMap.get(id));
            }
        }
    }

    // ------------------------------------------------------------------
    // Per-sensor control
    // ------------------------------------------------------------------

    public synchronized boolean startOne(String sensorId) {
        SensorSpec spec = specsMap.get(sensorId);
        if (spec == null) return false;
        if (!running.containsKey(sensorId)) {
            schedule(spec);
        }
        return true;
    }

    public synchronized boolean stopOne(String sensorId) {
        if (!specsMap.containsKey(sensorId)) return false;
        cancelTask(sensorId);
        return true;
    }

    // ------------------------------------------------------------------
    // Dynamic sensor management
    // ------------------------------------------------------------------

    /**
     * Register a new sensor. The sensor starts in stopped state.
     * Returns false if the id is already taken.
     */
    public synchronized boolean createSensor(SensorSpec spec) {
        if (specsMap.containsKey(spec.id())) return false;
        specsMap.put(spec.id(), spec);
        log.info("Created sensor {} (type={}, model={})", spec.id(), spec.type(), spec.dataModel());
        return true;
    }

    /**
     * Update an existing sensor spec. Restarts the sensor if it was running.
     * Model state is reset so stateful models start fresh.
     * Returns false if the id doesn't exist.
     */
    public synchronized boolean updateSensor(String sensorId, SensorSpec newSpec) {
        if (!specsMap.containsKey(sensorId)) return false;
        boolean wasRunning = running.containsKey(sensorId);
        cancelTask(sensorId);
        modelStates.remove(sensorId);
        specsMap.put(sensorId, newSpec);
        if (wasRunning) {
            schedule(newSpec);
        }
        log.info("Updated sensor {} (model={}, interval={}ms)", sensorId, newSpec.dataModel(), newSpec.intervalMs());
        return true;
    }

    /**
     * Remove a sensor from the catalog. Stops it first if running.
     * Returns false if the id doesn't exist.
     */
    public synchronized boolean deleteSensor(String sensorId) {
        if (!specsMap.containsKey(sensorId)) return false;
        cancelTask(sensorId);
        specsMap.remove(sensorId);
        modelStates.remove(sensorId);
        log.info("Deleted sensor {}", sensorId);
        return true;
    }

    /**
     * Generate the next available sensor id for a given type prefix.
     * e.g. if sensor-temp-001 and sensor-temp-002 exist, returns sensor-temp-003.
     */
    public synchronized String nextSensorId(String type) {
        String prefix = "sensor-" + type.substring(0, 4).toLowerCase() + "-";
        int n = 1;
        while (specsMap.containsKey(prefix + String.format("%03d", n))) n++;
        return prefix + String.format("%03d", n);
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private void schedule(SensorSpec spec) {
        long initialDelay = ThreadLocalRandom.current().nextLong(0, 1000);
        ModelState state = modelStates.computeIfAbsent(spec.id(), k -> new ModelState());

        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> {
            try {
                SensorData data = new SensorData();
                data.setSensorId(spec.id());
                data.setSensorType(spec.type());
                data.setValue(spec.dataModel().generate(spec, state));
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
        log.info("Started sensor {} (interval={}ms, model={})", spec.id(), spec.intervalMs(), spec.dataModel());
    }

    private void cancelTask(String sensorId) {
        ScheduledFuture<?> task = running.remove(sensorId);
        if (task != null) {
            task.cancel(false);
            log.info("Stopped sensor {}", sensorId);
        }
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
