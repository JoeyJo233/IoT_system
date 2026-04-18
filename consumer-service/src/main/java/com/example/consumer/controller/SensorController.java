package com.example.consumer.controller;

import com.example.consumer.model.SensorData;
import com.example.consumer.repository.SensorDataRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sensors")
public class SensorController {

    private final SensorDataRepository repository;
    private final RedisTemplate<String, SensorData> redisTemplate;

    private static final String CACHE_PREFIX = "sensor:latest:";

    public SensorController(SensorDataRepository repository,
                            RedisTemplate<String, SensorData> redisTemplate) {
        this.repository = repository;
        this.redisTemplate = redisTemplate;
    }

    // GET /api/sensors/{sensorId}/latest — returns latest reading from Redis cache
    @GetMapping("/{sensorId}/latest")
    public ResponseEntity<SensorData> getLatest(@PathVariable String sensorId) {
        String cacheKey = CACHE_PREFIX + sensorId;
        SensorData cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return ResponseEntity.ok(cached);
        }
        // Cache miss: fall back to MongoDB
        return repository.findBySensorIdOrderByTimestampDesc(sensorId)
                .stream().findFirst()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // GET /api/sensors/{sensorId}/history — returns historical readings from MongoDB
    @GetMapping("/{sensorId}/history")
    public List<SensorData> getHistory(@PathVariable String sensorId) {
        return repository.findBySensorIdOrderByTimestampDesc(sensorId);
    }

    // GET /api/sensors/type/{sensorType} — returns all readings by sensor type
    @GetMapping("/type/{sensorType}")
    public List<SensorData> getByType(@PathVariable String sensorType) {
        return repository.findBySensorTypeOrderByTimestampDesc(sensorType);
    }
}
