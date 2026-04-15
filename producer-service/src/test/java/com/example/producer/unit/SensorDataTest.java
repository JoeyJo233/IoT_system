package com.example.producer.unit;

import com.example.producer.model.SensorData;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SensorDataTest {

    @Test
    void testDefaultConstructor() {
        SensorData data = new SensorData();

        assertNull(data.getSensorId());
        assertNull(data.getSensorType());
        assertNull(data.getValue());
        assertNull(data.getUnit());
        assertNull(data.getTimestamp());
        assertNull(data.getLocation());
    }

    @Test
    void testAllArgsConstructor() {
        String sensorId = "sensor-001";
        String type = "TEMPERATURE";
        Double value = 25.5;
        String unit = "°C";
        Long timestamp = System.currentTimeMillis();
        String location = "warehouse-A";

        SensorData data = new SensorData(sensorId, type, value, unit, timestamp, location);

        assertEquals(sensorId, data.getSensorId());
        assertEquals(type, data.getSensorType());
        assertEquals(value, data.getValue());
        assertEquals(unit, data.getUnit());
        assertEquals(timestamp, data.getTimestamp());
        assertEquals(location, data.getLocation());
    }

    @Test
    void testSettersAndGetters() {
        SensorData data = new SensorData();
        data.setSensorId("sensor-002");
        data.setSensorType("HUMIDITY");
        data.setValue(65.0);
        data.setUnit("%");
        data.setTimestamp(123456789L);
        data.setLocation("warehouse-B");

        assertEquals("sensor-002", data.getSensorId());
        assertEquals("HUMIDITY", data.getSensorType());
        assertEquals(65.0, data.getValue());
        assertEquals("%", data.getUnit());
        assertEquals(123456789L, data.getTimestamp());
        assertEquals("warehouse-B", data.getLocation());
    }

    @Test
    void testToString() {
        SensorData data = new SensorData("sensor-003", "PRESSURE", 1013.25, "hPa", 123456789L, "pipeline-1");
        String result = data.toString();

        assertNotNull(result);
        assertTrue(result.contains("sensor-003"));
        assertTrue(result.contains("PRESSURE"));
        assertTrue(result.contains("1013.25"));
        assertTrue(result.contains("hPa"));
        assertTrue(result.contains("pipeline-1"));
    }

    @Test
    void testEqualsAndHashCode() {
        SensorData data1 = new SensorData("sensor-001", "TEMPERATURE", 25.0, "°C", 123L, "A");
        SensorData data2 = new SensorData("sensor-001", "TEMPERATURE", 25.0, "°C", 123L, "A");

        assertEquals(data1, data2);
        assertEquals(data1.hashCode(), data2.hashCode());
        assertEquals(data1, data1);
        assertNotEquals(data1, null);
    }

    @Test
    void testNotEquals() {
        SensorData data1 = new SensorData("sensor-001", "TEMPERATURE", 25.0, "°C", 123L, "A");
        SensorData data2 = new SensorData("sensor-002", "HUMIDITY", 60.0, "%", 456L, "B");

        assertNotEquals(data1, data2);
    }

    @Test
    void testNullValueHandling() {
        SensorData data = new SensorData();
        data.setSensorId("sensor-001");

        assertEquals("sensor-001", data.getSensorId());
        assertNull(data.getValue());
        assertNotNull(data.toString());
    }
}
