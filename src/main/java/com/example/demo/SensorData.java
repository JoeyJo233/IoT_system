package com.example.demo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 传感器数据模型
 */
@Data                    // Lombok注解：自动生成getter/setter/toString/equals/hashCode
@NoArgsConstructor       // 生成无参构造函数
@AllArgsConstructor      // 生成全参构造函数
public class SensorData {

    private String sensorId;      // 传感器ID，如 "sensor-001"
    private String sensorType;    // 传感器类型，如 "TEMPERATURE"
    private Double value;         // 数值，如 25.6
    private String unit;          // 单位，如 "°C"
    private Long timestamp;       // 时间戳（毫秒）
    private String location;      // 位置，如 "warehouse-A"
}