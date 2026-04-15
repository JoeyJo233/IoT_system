package com.example.consumer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

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
