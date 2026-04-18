package com.example.consumer;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

// Requires a live Kafka/Mongo/Redis; re-enable once Testcontainers is wired in.
@Disabled("Needs local infrastructure — run manually or via Testcontainers.")
@SpringBootTest
@TestPropertySource(properties = {
        "spring.kafka.bootstrap-servers=localhost:9092",
        "spring.data.mongodb.uri=mongodb://localhost:27017/iot-test",
        "spring.data.redis.host=localhost"
})
class ConsumerApplicationTests {

    @Test
    void contextLoads() {
    }
}
