package com.example.consumer.repository;

import com.example.consumer.model.SensorData;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SensorDataRepository extends MongoRepository<SensorData, String> {

    List<SensorData> findBySensorIdOrderByTimestampDesc(String sensorId);

    List<SensorData> findBySensorTypeOrderByTimestampDesc(String sensorType);
}
