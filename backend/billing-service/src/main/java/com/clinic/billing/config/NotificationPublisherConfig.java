package com.clinic.billing.config;

import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class NotificationPublisherConfig {
    @Bean
    Jackson2JsonMessageConverter notificationJsonConverter() { return new Jackson2JsonMessageConverter(); }

    @Bean
    RabbitTemplate notificationRabbitTemplate(ConnectionFactory connectionFactory,
                                               Jackson2JsonMessageConverter notificationJsonConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(notificationJsonConverter);
        template.setMandatory(true);
        return template;
    }
}
