package com.clinic.notification.mapper;

import com.clinic.notification.dto.BusinessNotificationType;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.entity.Notification;
import com.clinic.notification.entity.NotificationStatus;
import com.clinic.notification.entity.NotificationType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationMapperPrivacyTest {
    private final NotificationMapper mapper = Mappers.getMapper(NotificationMapper.class);
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void legacyArbitraryContentAndContactAreNotSerialized() throws Exception {
        String contact = "sensitive.patient@example.test";
        String privateText = "Diagnosis: sensitive clinical content";
        Notification notification = Notification.builder().id(UUID.randomUUID())
                .recipientUserId(UUID.randomUUID()).recipient(contact)
                .subject("Patient full name").content(privateText)
                .type(NotificationType.EMAIL).status(NotificationStatus.SENT).build();
        NotificationResponse response = mapper.toResponse(notification);
        String serialized = json.writeValueAsString(response);
        assertThat(serialized).doesNotContain(contact, privateText, "Patient full name",
                notification.getRecipientUserId().toString(), "recipientUserId", "recipient");
        assertThat(response.subject()).isEqualTo("Clinic update");
    }

    @Test
    void eventResponseUsesServerTemplateEvenIfStoredRowWasModified() throws Exception {
        Notification notification = Notification.builder().id(UUID.randomUUID())
                .recipientUserId(UUID.randomUUID()).recipient("+84901234567")
                .eventType(BusinessNotificationType.LAB_RESULT_READY.name())
                .subject("PII subject").content("private lab results")
                .type(NotificationType.IN_APP).status(NotificationStatus.SENT).build();
        String serialized = json.writeValueAsString(mapper.toResponse(notification));
        assertThat(serialized).contains(BusinessNotificationType.LAB_RESULT_READY.subject())
                .doesNotContain("+84901234567", "PII subject", "private lab results");
    }
}
