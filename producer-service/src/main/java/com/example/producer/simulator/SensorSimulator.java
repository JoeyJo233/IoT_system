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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

/**
 * IoT sensor simulator.
 * Each sensor runs independently with its own sampling interval.
 */
@Slf4j
@Service
public class SensorSimulator {

    private final KafkaTemplate<String, SensorData> kafkaTemplate;
    private final ScheduledExecutorService scheduler;
    private final List<ScheduledFuture<?>> scheduledTasks;
    private final String topic;

    public SensorSimulator(KafkaTemplate<String, SensorData> kafkaTemplate,
                           @Value("${app.kafka.topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
        this.scheduler = Executors.newScheduledThreadPool(10);
        this.scheduledTasks = new ArrayList<>();
    }

    // Wait for full context startup (Kafka connection, etc.) before emitting.
    @EventListener(ApplicationReadyEvent.class)
    public void startSensors() {
        log.info("Starting IoT sensor simulator");

        // Temperature sensors: sample every 10 seconds
        startSensor("sensor-temp-001", "TEMPERATURE", 10000, "°C", 15.0, 35.0, "warehouse-A");
        startSensor("sensor-temp-002", "TEMPERATURE", 10000, "°C", 15.0, 35.0, "warehouse-B");

        // Humidity sensors: sample every 5 seconds
        startSensor("sensor-humi-001", "HUMIDITY", 5000, "%", 30.0, 80.0, "warehouse-A");
        startSensor("sensor-humi-002", "HUMIDITY", 5000, "%", 30.0, 80.0, "warehouse-B");

        // Pressure sensors: sample every 2 seconds
        startSensor("sensor-pres-001", "PRESSURE", 2000, "hPa", 980.0, 1050.0, "pipeline-1");
        startSensor("sensor-pres-002", "PRESSURE", 2000, "hPa", 980.0, 1050.0, "pipeline-2");

        // Vibration sensors: sample every 500ms
        startSensor("sensor-vibr-001", "VIBRATION", 500, "mm/s", 0.0, 10.0, "machine-1");
        startSensor("sensor-vibr-002", "VIBRATION", 500, "mm/s", 0.0, 10.0, "machine-2");

        log.info("All sensors started");
    }

    private void startSensor(String sensorId, String type, long intervalMs,
                             String unit, double minValue, double maxValue, String location) {

        // Random initial delay to avoid thundering herd
        long initialDelay = ThreadLocalRandom.current().nextLong(0, 1000);

        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> {
            try {
                SensorData data = new SensorData();
                data.setSensorId(sensorId);
                data.setSensorType(type);
                data.setValue(ThreadLocalRandom.current().nextDouble(minValue, maxValue));
                data.setUnit(unit);
                data.setTimestamp(System.currentTimeMillis());
                data.setLocation(location);

                kafkaTemplate.send(topic, sensorId, data)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                log.error("[{}] send failed", sensorId, ex);
                            } else {
                                log.info("[{}] {} sent: {} {} @ partition={} offset={}",
                                        sensorId, Instant.ofEpochMilli(data.getTimestamp()),
                                        String.format("%.2f", data.getValue()), data.getUnit(),
                                        result.getRecordMetadata().partition(),
                                        result.getRecordMetadata().offset());
                            }
                        });

            } catch (Exception e) {
                log.error("[{}] sampling error", sensorId, e);
            }

        }, initialDelay, intervalMs, TimeUnit.MILLISECONDS);

        scheduledTasks.add(task);
    }

    @PreDestroy
    public void stopSensors() {
        log.info("Stopping all sensors...");
        scheduledTasks.forEach(task -> task.cancel(false));
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
        }
        log.info("All sensors stopped");
    }
}
