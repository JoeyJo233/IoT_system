package com.example.consumer.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "sensor_readings")
@CompoundIndex(def = "{'sensorId': 1, 'timestamp': -1}")
public class SensorData {

    @Id
    private String id;

    private String sensorId;
    private String sensorType;
    private Double value;
    private String unit;
    private Long timestamp;
    private String location;
}
