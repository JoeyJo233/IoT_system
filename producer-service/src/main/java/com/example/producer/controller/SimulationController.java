package com.example.producer.controller;

import com.example.producer.simulator.SensorSimulator;
import com.example.producer.simulator.SensorSpec;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Runtime control surface for the sensor simulator. The Web UI talks to this
 * controller to start/stop sensors individually or globally and to drive its
 * sensor catalog from a single source of truth.
 */
@RestController
@RequestMapping("/api/simulation")
@CrossOrigin // dev convenience; safe because this service has no credentials
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

    // ---- per-sensor control ----------------------------------------------

    @PostMapping("/sensors/{sensorId}/start")
    public ResponseEntity<SensorStatus> startOne(@PathVariable String sensorId) {
        if (!simulator.startOne(sensorId)) {
            return ResponseEntity.notFound().build();
        }
        SensorSpec spec = simulator.findSpec(sensorId).orElseThrow();
        return ResponseEntity.ok(SensorStatus.from(spec, simulator.isRunning(sensorId)));
    }

    @PostMapping("/sensors/{sensorId}/stop")
    public ResponseEntity<SensorStatus> stopOne(@PathVariable String sensorId) {
        if (!simulator.stopOne(sensorId)) {
            return ResponseEntity.notFound().build();
        }
        SensorSpec spec = simulator.findSpec(sensorId).orElseThrow();
        return ResponseEntity.ok(SensorStatus.from(spec, simulator.isRunning(sensorId)));
    }

    // ---- DTOs -------------------------------------------------------------

    public record StatusResponse(
            boolean running,
            long activeCount,
            long totalCount,
            double messageRatePerSecond,
            List<SensorStatus> sensors
    ) {
    }

    public record SensorStatus(
            String sensorId,
            String sensorType,
            long intervalMs,
            String unit,
            double minValue,
            double maxValue,
            String location,
            boolean running
    ) {
        public static SensorStatus from(SensorSpec spec, boolean running) {
            return new SensorStatus(
                    spec.id(), spec.type(), spec.intervalMs(),
                    spec.unit(), spec.minValue(), spec.maxValue(),
                    spec.location(), running
            );
        }
    }
}
