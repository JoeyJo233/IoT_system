package com.example.consumer.consumer;

import com.example.consumer.model.SensorData;
import com.example.consumer.repository.SensorDataRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.Duration;

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
    public void consume(SensorData data) {
        // Persist to MongoDB
        repository.save(data);

        // Cache latest reading per sensor in Redis
        String cacheKey = CACHE_PREFIX + data.getSensorId();
        redisTemplate.opsForValue().set(cacheKey, data, CACHE_TTL);
    }
}
