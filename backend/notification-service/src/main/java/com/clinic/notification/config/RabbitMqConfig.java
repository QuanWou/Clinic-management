package com.clinic.notification.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({NotificationRabbitProperties.class, SmsNotificationProperties.class})
public class RabbitMqConfig {

    @Bean
    public DirectExchange notificationExchange(NotificationRabbitProperties properties) {
        return new DirectExchange(properties.exchange(), true, false);
    }

    @Bean
    public Queue notificationQueue(NotificationRabbitProperties properties) {
        // A new queue name is required when upgrading an existing RabbitMQ deployment:
        // redeclaring the legacy queue with new arguments causes PRECONDITION_FAILED.
        return QueueBuilder.durable(properties.queue())
                .deadLetterExchange(properties.exchange() + ".dead")
                .deadLetterRoutingKey(properties.routingKey() + ".dead")
                .build();
    }

    @Bean
    public DirectExchange notificationDeadExchange(NotificationRabbitProperties properties) {
        return new DirectExchange(properties.exchange() + ".dead", true, false);
    }

    @Bean
    public Queue notificationDeadQueue(NotificationRabbitProperties properties) {
        return QueueBuilder.durable(properties.queue() + ".dead").build();
    }

    @Bean
    public Binding notificationDeadBinding(@Qualifier("notificationDeadQueue") Queue notificationDeadQueue,
                                           @Qualifier("notificationDeadExchange") DirectExchange notificationDeadExchange,
                                           NotificationRabbitProperties properties) {
        return BindingBuilder.bind(notificationDeadQueue).to(notificationDeadExchange)
                .with(properties.routingKey() + ".dead");
    }

    @Bean
    public Queue notificationEventDeadQueue(NotificationRabbitProperties properties) {
        return QueueBuilder.durable(properties.eventQueue() + ".dead").build();
    }

    @Bean
    public Binding notificationEventDeadBinding(@Qualifier("notificationEventDeadQueue") Queue queue,
                                               @Qualifier("notificationDeadExchange") DirectExchange exchange,
                                               NotificationRabbitProperties properties) {
        return BindingBuilder.bind(queue).to(exchange).with(properties.eventRoutingKey() + ".dead");
    }

    @Bean
    public Binding notificationBinding(@Qualifier("notificationQueue") Queue notificationQueue,
                                       @Qualifier("notificationExchange") DirectExchange notificationExchange,
                                       NotificationRabbitProperties properties) {
        return BindingBuilder.bind(notificationQueue).to(notificationExchange).with(properties.routingKey());
    }

    @Bean
    public Queue notificationEventsQueue(NotificationRabbitProperties properties) {
        return QueueBuilder.durable(properties.eventQueue())
                .withArgument("x-dead-letter-exchange", properties.exchange() + ".dead")
                .withArgument("x-dead-letter-routing-key", properties.eventRoutingKey() + ".dead")
                .build();
    }

    @Bean
    public Binding notificationEventsBinding(@Qualifier("notificationEventsQueue") Queue queue,
                                              @Qualifier("notificationExchange") DirectExchange exchange,
                                              NotificationRabbitProperties properties) {
        return BindingBuilder.bind(queue).to(exchange).with(properties.eventRoutingKey());
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter);
        rabbitTemplate.setMandatory(true);
        return rabbitTemplate;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            MessageConverter messageConverter
    ) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        factory.setDefaultRequeueRejected(false);
        return factory;
    }

    @Bean
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }
}
