package com.example.producer.controller;

import com.example.producer.model.SensorData;
import com.example.producer.simulator.SensorSimulator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SimulationControllerTest {

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, SensorData> kafkaTemplate = mock(KafkaTemplate.class);
    private SensorSimulator simulator;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        when(kafkaTemplate.send(anyString(), anyString(), any(SensorData.class)))
                .thenReturn(new CompletableFuture<>());
        simulator = new SensorSimulator(kafkaTemplate, "test-topic");
        // Note: don't call startSensors() here — we want a clean baseline.
        mockMvc = MockMvcBuilders.standaloneSetup(new SimulationController(simulator)).build();
    }

    @AfterEach
    void tearDown() {
        simulator.shutdown();
    }

    @Test
    void status_returnsCatalog_withAllSensorsStopped_initially() throws Exception {
        mockMvc.perform(get("/api/simulation/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(false))
                .andExpect(jsonPath("$.activeCount").value(0))
                .andExpect(jsonPath("$.totalCount").value(8))
                .andExpect(jsonPath("$.sensors.length()").value(8))
                .andExpect(jsonPath("$.sensors[0].sensorId").value("sensor-temp-001"));
    }

    @Test
    void startAll_thenStopAll_flipsRunningFlag() throws Exception {
        mockMvc.perform(post("/api/simulation/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(true))
                .andExpect(jsonPath("$.activeCount").value(8));

        mockMvc.perform(post("/api/simulation/stop"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(false))
                .andExpect(jsonPath("$.activeCount").value(0));
    }

    @Test
    void startOne_togglesJustThatSensor() throws Exception {
        mockMvc.perform(post("/api/simulation/sensors/sensor-vibr-001/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensorId").value("sensor-vibr-001"))
                .andExpect(jsonPath("$.running").value(true));

        mockMvc.perform(get("/api/simulation/status"))
                .andExpect(jsonPath("$.activeCount").value(1));

        mockMvc.perform(post("/api/simulation/sensors/sensor-vibr-001/stop"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(false));
    }

    @Test
    void startOne_unknownSensor_returns404() throws Exception {
        mockMvc.perform(post("/api/simulation/sensors/does-not-exist/start"))
                .andExpect(status().isNotFound());
    }
}
