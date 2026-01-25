package com.example.demo;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.ThreadLocalRandom;

/**
 * 传感器模拟器
 * 功能：每5秒生成一次模拟的传感器数据并发送到Kafka
 */
// @Service  // 标记为Spring服务，自动管理
public class SensorSimulator {

    private final KafkaTemplate<String, SensorData> kafkaTemplate;
    private static final String TOPIC = "iot-sensor-data";  // Kafka主题名

    // 构造函数注入（Spring推荐方式）
    public SensorSimulator(KafkaTemplate<String, SensorData> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * 定时任务：每5秒执行一次
     * fixedRate = 5000：每5000毫秒（5秒）执行一次
     * initialDelay = 3000：启动后延迟3秒再开始执行
     */
    @Scheduled(fixedRate = 5000, initialDelay = 3000)
    public void generateAndSendData() {
        // 模拟5个传感器
        for (int i = 1; i <= 5; i++) {
            SensorData data = createSensorData(i);

            // 发送到Kafka
            kafkaTemplate.send(TOPIC, data.getSensorId(), data)
                    .whenComplete((result, ex) -> {
                        if (ex == null) {
                            // 发送成功
                            System.out.println("✅ " + data.getSensorId() +
                                    " [" + data.getSensorType() + "] = " +
                                    String.format("%.2f", data.getValue()) + data.getUnit());
                        } else {
                            // 发送失败
                            System.err.println("❌ 发送失败: " + ex.getMessage());
                        }
                    });
        }
        System.out.println("---");  // 分隔线
    }

    /**
     * 生成随机传感器数据
     */
    private SensorData createSensorData(int sensorNum) {
        SensorData data = new SensorData();
        data.setSensorId(String.format("sensor-%03d", sensorNum));  // sensor-001, sensor-002...
        data.setTimestamp(System.currentTimeMillis());
        data.setLocation("warehouse-" + (char)('A' + (sensorNum % 3)));  // warehouse-A/B/C

        // 根据传感器编号决定类型（循环分配）
        switch (sensorNum % 3) {
            case 0:  // 温度传感器
                data.setSensorType("TEMPERATURE");
                data.setValue(ThreadLocalRandom.current().nextDouble(15.0, 35.0));
                data.setUnit("°C");
                break;
            case 1:  // 湿度传感器
                data.setSensorType("HUMIDITY");
                data.setValue(ThreadLocalRandom.current().nextDouble(30.0, 80.0));
                data.setUnit("%");
                break;
            case 2:  // 压力传感器
                data.setSensorType("PRESSURE");
                data.setValue(ThreadLocalRandom.current().nextDouble(980.0, 1050.0));
                data.setUnit("hPa");
                break;
        }

        return data;
    }
}