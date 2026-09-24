package com.clinic.notification.provider;

import com.clinic.notification.entity.NotificationType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class NotificationProviderResolver {

    private final Map<NotificationType, NotificationProvider> providers;

    public NotificationProviderResolver(List<NotificationProvider> providers) {
        this.providers = new EnumMap<>(NotificationType.class);
        providers.forEach(provider -> this.providers.put(provider.type(), provider));
    }

    public NotificationProvider resolve(NotificationType type) {
        NotificationProvider provider = providers.get(type);
        if (provider == null) {
            throw new IllegalStateException("Notification provider is not configured for type " + type);
        }
        return provider;
    }
}
