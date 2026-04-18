package com.example.consumer.controller;

import com.example.consumer.model.SensorData;
import com.example.consumer.repository.SensorDataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SensorControllerTest {

    @SuppressWarnings("unchecked")
    private final SensorDataRepository repository = mock(SensorDataRepository.class);
    @SuppressWarnings("unchecked")
    private final RedisTemplate<String, SensorData> redisTemplate = mock(RedisTemplate.class);
    @SuppressWarnings("unchecked")
    private final ValueOperations<String, SensorData> valueOps = mock(ValueOperations.class);

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        mockMvc = MockMvcBuilders.standaloneSetup(new SensorController(repository, redisTemplate))
                .build();
    }

    @Test
    void getLatest_returnsCachedValue_whenRedisHit() throws Exception {
        SensorData data = sample("sensor-temp-001");
        when(valueOps.get("sensor:latest:sensor-temp-001")).thenReturn(data);

        mockMvc.perform(get("/api/sensors/sensor-temp-001/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensorId").value("sensor-temp-001"));

        verifyNoInteractions(repository);
    }

    @Test
    void getLatest_fallsBackToMongo_whenRedisMiss() throws Exception {
        when(valueOps.get("sensor:latest:sensor-temp-001")).thenReturn(null);
        when(repository.findBySensorIdOrderByTimestampDesc("sensor-temp-001"))
                .thenReturn(List.of(sample("sensor-temp-001")));

        mockMvc.perform(get("/api/sensors/sensor-temp-001/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensorId").value("sensor-temp-001"));
    }

    @Test
    void getLatest_returns404_whenRedisMissAndMongoEmpty() throws Exception {
        when(valueOps.get(anyString())).thenReturn(null);
        when(repository.findBySensorIdOrderByTimestampDesc("unknown"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/sensors/unknown/latest"))
                .andExpect(status().isNotFound());
    }

    private SensorData sample(String sensorId) {
        SensorData d = new SensorData();
        d.setSensorId(sensorId);
        d.setSensorType("TEMPERATURE");
        d.setValue(22.5);
        d.setUnit("°C");
        d.setTimestamp(System.currentTimeMillis());
        d.setLocation("warehouse-A");
        return d;
    }
}
