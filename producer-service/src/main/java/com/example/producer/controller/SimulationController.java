package com.example.producer.controller;

import com.example.producer.simulator.DataModel;
import com.example.producer.simulator.SensorSimulator;
import com.example.producer.simulator.SensorSpec;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Runtime control surface for the sensor simulator. Supports global start/stop,
 * per-sensor start/stop, and full CRUD for the sensor catalog.
 */
@RestController
@RequestMapping("/api/simulation")
@CrossOrigin
public class SimulationController {

    private final SensorSimulator simulator;

    public SimulationController(SensorSimulator simulator) {
        this.simulator = simulator;
    }

    // ---- status & catalog -------------------------------------------------

    @GetMapping("/status")
    public StatusResponse status() {
        List<SensorStatus> sensors = simulator.specs().stream()
                .map(spec -> SensorStatus.from(spec, simulator.isRunning(spec.id())))
                .toList();
        return new StatusResponse(
                simulator.anyRunning(),
                sensors.stream().filter(SensorStatus::running).count(),
                sensors.size(),
                simulator.currentRate(),
                sensors
        );
    }

    @GetMapping("/sensors")
    public List<SensorStatus> catalog() {
        return simulator.specs().stream()
                .map(spec -> SensorStatus.from(spec, simulator.isRunning(spec.id())))
                .toList();
    }

    // ---- global control ---------------------------------------------------

    @PostMapping("/start")
    public StatusResponse startAll() {
        simulator.startAll();
        return status();
    }

    @PostMapping("/stop")
    public StatusResponse stopAll() {
        simulator.stopAll();
        return status();
    }

    // ---- per-sensor start/stop -------------------------------------------

    @PostMapping("/sensors/{sensorId}/start")
    public ResponseEntity<SensorStatus> startOne(@PathVariable String sensorId) {
        if (!simulator.startOne(sensorId)) return ResponseEntity.notFound().build();
        SensorSpec spec = simulator.findSpec(sensorId).orElseThrow();
        return ResponseEntity.ok(SensorStatus.from(spec, simulator.isRunning(sensorId)));
    }

    @PostMapping("/sensors/{sensorId}/stop")
    public ResponseEntity<SensorStatus> stopOne(@PathVariable String sensorId) {
        if (!simulator.stopOne(sensorId)) return ResponseEntity.notFound().build();
        SensorSpec spec = simulator.findSpec(sensorId).orElseThrow();
        return ResponseEntity.ok(SensorStatus.from(spec, simulator.isRunning(sensorId)));
    }

    // ---- sensor CRUD -------------------------------------------------------

    @PostMapping("/sensors")
    public ResponseEntity<SensorStatus> createSensor(@RequestBody CreateSensorRequest req) {
        if (req.sensorType() == null || req.location() == null || req.location().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (req.minValue() >= req.maxValue()) {
            return ResponseEntity.badRequest().build();
        }
        if (req.intervalMs() <= 0) {
            return ResponseEntity.badRequest().build();
        }

        String id = (req.sensorId() != null && !req.sensorId().isBlank())
                ? req.sensorId()
                : simulator.nextSensorId(req.sensorType());

        DataModel model = parseModel(req.dataModel());
        String unit = unitForType(req.sensorType());

        SensorSpec spec = new SensorSpec(id, req.sensorType().toUpperCase(),
                req.intervalMs(), unit, req.minValue(), req.maxValue(),
                req.location(), model);

        if (!simulator.createSensor(spec)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(SensorStatus.from(spec, false));
    }

    @PutMapping("/sensors/{sensorId}")
    public ResponseEntity<SensorStatus> updateSensor(@PathVariable String sensorId,
                                                      @RequestBody UpdateSensorRequest req) {
        var existing = simulator.findSpec(sensorId);
        if (existing.isEmpty()) return ResponseEntity.notFound().build();
        if (req.minValue() >= req.maxValue() || req.intervalMs() <= 0) {
            return ResponseEntity.badRequest().build();
        }
        DataModel model = parseModel(req.dataModel());
        SensorSpec updated = new SensorSpec(
                sensorId, existing.get().type(), req.intervalMs(), existing.get().unit(),
                req.minValue(), req.maxValue(), req.location(), model);
        simulator.updateSensor(sensorId, updated);
        return ResponseEntity.ok(SensorStatus.from(updated, simulator.isRunning(sensorId)));
    }

    @DeleteMapping("/sensors/{sensorId}")
    public ResponseEntity<Void> deleteSensor(@PathVariable String sensorId) {
        if (!simulator.deleteSensor(sensorId)) return ResponseEntity.notFound().build();
        return ResponseEntity.noContent().build();
    }

    // ---- helpers ----------------------------------------------------------

    private static DataModel parseModel(String name) {
        if (name == null || name.isBlank()) return DataModel.RANDOM;
        try {
            return DataModel.valueOf(name.toUpperCase());
        } catch (IllegalArgumentException e) {
            return DataModel.RANDOM;
        }
    }

    private static String unitForType(String type) {
        return switch (type.toUpperCase()) {
            case "TEMPERATURE" -> "°C";
            case "HUMIDITY"    -> "%";
            case "PRESSURE"    -> "hPa";
            case "VIBRATION"   -> "mm/s";
            default -> "";
        };
    }

    // ---- DTOs -------------------------------------------------------------

    public record StatusResponse(
            boolean running,
            long activeCount,
            long totalCount,
            double messageRatePerSecond,
            List<SensorStatus> sensors
    ) {}

    public record SensorStatus(
            String sensorId,
            String sensorType,
            long intervalMs,
            String unit,
            double minValue,
            double maxValue,
            String location,
            boolean running,
            String dataModel
    ) {
        public static SensorStatus from(SensorSpec spec, boolean running) {
            return new SensorStatus(
                    spec.id(), spec.type(), spec.intervalMs(),
                    spec.unit(), spec.minValue(), spec.maxValue(),
                    spec.location(), running,
                    spec.dataModel().name()
            );
        }
    }

    public record CreateSensorRequest(
            String sensorId,
            String sensorType,
            long intervalMs,
            double minValue,
            double maxValue,
            String location,
            String dataModel
    ) {}

    public record UpdateSensorRequest(
            long intervalMs,
            double minValue,
            double maxValue,
            String location,
            String dataModel
    ) {}
}
