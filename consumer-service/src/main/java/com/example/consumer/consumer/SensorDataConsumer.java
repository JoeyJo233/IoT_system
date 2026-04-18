package com.example.consumer.consumer;

import com.example.consumer.model.SensorData;
import com.example.consumer.repository.SensorDataRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class SensorDataConsumer {

    private final SensorDataRepository repository;
    private final RedisTemplate<String, SensorData> redisTemplate;

    private static final String CACHE_PREFIX = "sensor:latest:";
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    public SensorDataConsumer(SensorDataRepository repository,
                              RedisTemplate<String, SensorData> redisTemplate) {
        this.repository = repository;
        this.redisTemplate = redisTemplate;
    }

    @KafkaListener(topics = "iot-sensor-data", groupId = "iot-consumer-group")
    public void consume(SensorData data,
                        @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
                        @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                        @Header(KafkaHeaders.OFFSET) long offset) {

        // Deterministic _id makes Mongo save() an upsert on Kafka redelivery.
        data.setId(topic + "-" + partition + "-" + offset);
        repository.save(data);

        String cacheKey = CACHE_PREFIX + data.getSensorId();
        redisTemplate.opsForValue().set(cacheKey, data, CACHE_TTL);

        System.out.printf("[%s] %s received: %.2f %s @ partition=%d offset=%d%n",
                data.getSensorId(), Instant.ofEpochMilli(data.getTimestamp()),
                data.getValue(), data.getUnit(), partition, offset);
    }
}
