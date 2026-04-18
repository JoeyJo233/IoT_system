package com.example.consumer.consumer;

import com.example.consumer.model.SensorData;
import com.example.consumer.repository.SensorDataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SensorDataConsumerTest {

    @SuppressWarnings("unchecked")
    private final SensorDataRepository repository = mock(SensorDataRepository.class);
    @SuppressWarnings("unchecked")
    private final RedisTemplate<String, SensorData> redisTemplate = mock(RedisTemplate.class);
    @SuppressWarnings("unchecked")
    private final ValueOperations<String, SensorData> valueOps = mock(ValueOperations.class);

    private SensorDataConsumer consumer;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        consumer = new SensorDataConsumer(repository, redisTemplate);
    }

    @Test
    void consume_setsDeterministicIdFromTopicPartitionOffset() {
        SensorData data = sample();

        consumer.consume(data, "iot-sensor-data", 2, 42L);

        ArgumentCaptor<SensorData> saved = ArgumentCaptor.forClass(SensorData.class);
        verify(repository).save(saved.capture());
        // Redelivery of (topic, partition, offset) -> same _id -> Mongo upsert.
        assertThat(saved.getValue().getId()).isEqualTo("iot-sensor-data-2-42");
    }

    @Test
    void consume_writesLatestReadingToRedisWithTtl() {
        SensorData data = sample();

        consumer.consume(data, "iot-sensor-data", 0, 1L);

        verify(valueOps).set(eq("sensor:latest:sensor-temp-001"), eq(data), any(Duration.class));
    }

    @Test
    void consume_redeliveryProducesSameIdSoSaveIsIdempotentByKey() {
        SensorData first = sample();
        SensorData redelivery = sample();

        consumer.consume(first, "iot-sensor-data", 1, 100L);
        consumer.consume(redelivery, "iot-sensor-data", 1, 100L);

        verify(repository, times(2)).save(any(SensorData.class));
        assertThat(first.getId()).isEqualTo(redelivery.getId());
    }

    private SensorData sample() {
        SensorData d = new SensorData();
        d.setSensorId("sensor-temp-001");
        d.setSensorType("TEMPERATURE");
        d.setValue(22.5);
        d.setUnit("°C");
        d.setTimestamp(System.currentTimeMillis());
        d.setLocation("warehouse-A");
        return d;
    }
}
