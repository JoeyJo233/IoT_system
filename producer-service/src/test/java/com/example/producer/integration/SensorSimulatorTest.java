package com.example.producer.integration;

import com.example.producer.model.SensorData;
import com.example.producer.simulator.SensorSimulator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class SensorSimulatorTest {

    @Mock
    private KafkaTemplate<String, SensorData> kafkaTemplate;

    @InjectMocks
    private SensorSimulator simulator;

    @Test
    void testSensorSimulatorCreation() {
        assertNotNull(simulator);
    }
}
