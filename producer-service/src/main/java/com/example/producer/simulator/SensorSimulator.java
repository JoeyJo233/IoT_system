package com.example.producer.simulator;

import com.example.producer.model.SensorData;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

/**
 * IoT sensor simulator.
 * Each sensor runs independently with its own sampling interval.
 */
@Service
public class SensorSimulator {

    private final KafkaTemplate<String, SensorData> kafkaTemplate;
    private final ScheduledExecutorService scheduler;
    private final List<ScheduledFuture<?>> scheduledTasks;
    private static final String TOPIC = "iot-sensor-data";

    public SensorSimulator(KafkaTemplate<String, SensorData> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
        this.scheduler = Executors.newScheduledThreadPool(10);
        this.scheduledTasks = new ArrayList<>();
    }

    @PostConstruct
    public void startSensors() {
        System.out.println("Starting IoT sensor simulator");

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

        System.out.println("All sensors started");
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

                kafkaTemplate.send(TOPIC, sensorId, data)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                System.err.printf("[%s] send failed: %s%n", sensorId, ex.getMessage());
                            } else {
                                System.out.printf("[%s] sent: %.2f %s @ partition=%d offset=%d%n",
                                        sensorId, data.getValue(), data.getUnit(),
                                        result.getRecordMetadata().partition(),
                                        result.getRecordMetadata().offset());
                            }
                        });

            } catch (Exception e) {
                System.err.printf("[%s] sampling error: %s%n", sensorId, e.getMessage());
            }

        }, initialDelay, intervalMs, TimeUnit.MILLISECONDS);

        scheduledTasks.add(task);
    }

    @PreDestroy
    public void stopSensors() {
        System.out.println("Stopping all sensors...");
        scheduledTasks.forEach(task -> task.cancel(false));
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
        }
        System.out.println("All sensors stopped");
    }
}
