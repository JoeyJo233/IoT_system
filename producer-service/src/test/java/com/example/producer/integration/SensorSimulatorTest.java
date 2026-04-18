package com.example.producer.integration;

import com.example.producer.model.SensorData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;

import com.example.producer.simulator.SensorSimulator;

import java.util.concurrent.CompletableFuture;

import static org.awaitility.Awaitility.await;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SensorSimulatorTest {

    private static final String TOPIC = "test-topic";

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, SensorData> kafkaTemplate = mock(KafkaTemplate.class);
    private SensorSimulator simulator;

    @BeforeEach
    void setUp() {
        // Return a pending future so the whenComplete callback never fires
        // (avoids logging a NullPointerException in test output).
        when(kafkaTemplate.send(anyString(), anyString(), any(SensorData.class)))
                .thenReturn(new CompletableFuture<>());
        simulator = new SensorSimulator(kafkaTemplate, TOPIC);
    }

    @AfterEach
    void tearDown() {
        simulator.stopSensors();
    }

    @Test
    void startSensors_publishesToConfiguredTopic_withSensorIdAsKey() {
        simulator.startSensors();

        // Vibration sensors sample every 500ms → several sends within 2s.
        await().atMost(3, SECONDS).untilAsserted(() ->
                verify(kafkaTemplate, atLeast(4))
                        .send(eq(TOPIC), anyString(), any(SensorData.class)));

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SensorData> valueCaptor = ArgumentCaptor.forClass(SensorData.class);
        verify(kafkaTemplate, atLeastOnce())
                .send(eq(TOPIC), keyCaptor.capture(), valueCaptor.capture());

        // Kafka key must equal the payload's sensorId (used for partition affinity).
        for (int i = 0; i < keyCaptor.getAllValues().size(); i++) {
            assertThat(keyCaptor.getAllValues().get(i))
                    .isEqualTo(valueCaptor.getAllValues().get(i).getSensorId());
        }

        // Every emitted record has the required fields populated.
        assertThat(valueCaptor.getAllValues()).allSatisfy(data -> {
            assertThat(data.getSensorId()).isNotBlank();
            assertThat(data.getSensorType()).isNotBlank();
            assertThat(data.getValue()).isNotNull();
            assertThat(data.getUnit()).isNotBlank();
            assertThat(data.getTimestamp()).isPositive();
            assertThat(data.getLocation()).isNotBlank();
        });
    }
}
