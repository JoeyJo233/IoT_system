package com.example.consumer.config;

import com.example.consumer.model.SensorData;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, SensorData> sensorDataRedisTemplate(
            RedisConnectionFactory connectionFactory) {

        RedisTemplate<String, SensorData> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // Bind the serializer to SensorData so reads deserialize to the correct
        // type instead of LinkedHashMap.
        JacksonJsonRedisSerializer<SensorData> valueSerializer =
                new JacksonJsonRedisSerializer<>(SensorData.class);

        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(valueSerializer);
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(valueSerializer);

        template.afterPropertiesSet();
        return template;
    }
}
