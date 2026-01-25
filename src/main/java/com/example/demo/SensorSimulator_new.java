package com.example.demo;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

/**
 * 真实IoT传感器模拟器
 * 每个传感器独立运行，有自己的采样频率
 */
@Service
public class SensorSimulator_new {

    private final KafkaTemplate<String, SensorData> kafkaTemplate;
    private final ScheduledExecutorService scheduler;
    private final List<ScheduledFuture<?>> scheduledTasks;
    private static final String TOPIC = "iot-sensor-data";

    public SensorSimulator_new(KafkaTemplate<String, SensorData> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
        // 创建线程池：10个传感器需要10个线程
        this.scheduler = Executors.newScheduledThreadPool(10);
        this.scheduledTasks = new ArrayList<>();
    }

    /**
     * 应用启动后自动执行
     * 为每个传感器创建独立的定时任务
     */
    @PostConstruct
    public void startSensors() {
        System.out.println("🚀 启动真实IoT传感器模拟器");

        // 温度传感器：每10秒采样
        startSensor("sensor-temp-001", "TEMPERATURE", 10000, "°C", 15.0, 35.0, "warehouse-A");
        startSensor("sensor-temp-002", "TEMPERATURE", 10000, "°C", 15.0, 35.0, "warehouse-B");

        // 湿度传感器：每5秒采样
        startSensor("sensor-humi-001", "HUMIDITY", 5000, "%", 30.0, 80.0, "warehouse-A");
        startSensor("sensor-humi-002", "HUMIDITY", 5000, "%", 30.0, 80.0, "warehouse-B");

        // 压力传感器：每2秒采样（高频）
        startSensor("sensor-pres-001", "PRESSURE", 2000, "hPa", 980.0, 1050.0, "pipeline-1");
        startSensor("sensor-pres-002", "PRESSURE", 2000, "hPa", 980.0, 1050.0, "pipeline-2");

        // 振动传感器：每500毫秒采样（超高频）
        startSensor("sensor-vibr-001", "VIBRATION", 500, "mm/s", 0.0, 10.0, "machine-1");
        startSensor("sensor-vibr-002", "VIBRATION", 500, "mm/s", 0.0, 10.0, "machine-2");

        System.out.println("✅ 所有传感器已启动，采样频率各不相同");
    }

    /**
     * 启动单个传感器
     *
     * @param sensorId 传感器ID
     * @param type 传感器类型
     * @param intervalMs 采样间隔（毫秒）
     * @param unit 单位
     * @param minValue 最小值
     * @param maxValue 最大值
     * @param location 位置
     */
    private void startSensor(String sensorId, String type, long intervalMs,
                             String unit, double minValue, double maxValue, String location) {

        // 添加随机初始延迟（0-1000ms），避免所有传感器同时启动
        long initialDelay = ThreadLocalRandom.current().nextLong(0, 1000);

        // 创建独立的定时任务
        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> {
            try {
                // 生成传感器数据
                SensorData data = new SensorData();
                data.setSensorId(sensorId);
                data.setSensorType(type);
                data.setValue(ThreadLocalRandom.current().nextDouble(minValue, maxValue));
                data.setUnit(unit);
                data.setTimestamp(System.currentTimeMillis());
                data.setLocation(location);

                // 发送到Kafka
                kafkaTemplate.send(TOPIC, sensorId, data)
                        .whenComplete((result, ex) -> {
                            if (ex == null) {
                                System.out.printf("✅ [%s] %s = %.2f%s (间隔:%dms)%n",
                                        sensorId, type, data.getValue(), unit, intervalMs);
                            } else {
                                System.err.printf("❌ [%s] 发送失败: %s%n", sensorId, ex.getMessage());
                            }
                        });

            } catch (Exception e) {
                // 单个传感器出错不影响其他传感器
                System.err.printf("⚠️ [%s] 采样异常: %s%n", sensorId, e.getMessage());
            }

        }, initialDelay, intervalMs, TimeUnit.MILLISECONDS);

        scheduledTasks.add(task);
    }

    /**
     * 应用关闭前执行
     * 优雅地停止所有传感器
     */
    @PreDestroy
    public void stopSensors() {
        System.out.println("🛑 停止所有传感器...");

        // 取消所有定时任务
        scheduledTasks.forEach(task -> task.cancel(false));

        // 关闭线程池
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
        }

        System.out.println("✅ 所有传感器已停止");
    }
}