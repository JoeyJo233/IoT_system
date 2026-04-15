package com.example.producer.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SensorData {

    private String sensorId;
    private String sensorType;
    private Double value;
    private String unit;
    private Long timestamp;
    private String location;
}
