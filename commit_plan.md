# Commit Plan: Billing & Notification Features

> Tất cả file trong `billing-service/` và `notification-service/` đều là **untracked** (chưa có trong git).
> Frontend hiện cũng chưa được track. Thực hiện các lệnh theo đúng thứ tự dưới đây.

---

## 1. `feat(billing): initialize billing service`

**Files cần `git add`:**
```
backend/billing-service/pom.xml
backend/billing-service/src/main/java/com/clinic/billing/BillingServiceApplication.java
backend/billing-service/src/main/java/com/clinic/billing/config/RestClientConfig.java
backend/billing-service/src/main/java/com/clinic/billing/security/CurrentUserPrincipal.java
backend/billing-service/src/main/java/com/clinic/billing/security/JwtAuthenticationFilter.java
backend/billing-service/src/main/java/com/clinic/billing/security/JwtProperties.java
backend/billing-service/src/main/java/com/clinic/billing/security/JwtService.java
backend/billing-service/src/main/java/com/clinic/billing/security/SecurityConfig.java
backend/billing-service/src/main/java/com/clinic/billing/exception/GlobalExceptionHandler.java
backend/billing-service/src/main/resources/application.yml
backend/billing-service/src/main/resources/application-local.yml
```

**Lệnh:**
```bash
git add backend/billing-service/pom.xml \
        backend/billing-service/src/main/java/com/clinic/billing/BillingServiceApplication.java \
        backend/billing-service/src/main/java/com/clinic/billing/config/ \
        backend/billing-service/src/main/java/com/clinic/billing/security/ \
        backend/billing-service/src/main/java/com/clinic/billing/exception/ \
        backend/billing-service/src/main/resources/application.yml \
        backend/billing-service/src/main/resources/application-local.yml
git commit -m "feat(billing): initialize billing service"
```

---

## 2. `feat(billing): add invoice entity`

**Files cần `git add`:**
```
backend/billing-service/src/main/java/com/clinic/billing/entity/Invoice.java
backend/billing-service/src/main/java/com/clinic/billing/entity/InvoiceStatus.java
backend/billing-service/src/main/java/com/clinic/billing/entity/PaymentMethod.java
backend/billing-service/src/main/resources/db/migration/V1__create_billing_tables.sql
```

**Lệnh:**
```bash
git add backend/billing-service/src/main/java/com/clinic/billing/entity/ \
        backend/billing-service/src/main/resources/db/
git commit -m "feat(billing): add invoice entity"
```

---

## 3. `feat(billing): add invoice repository`

**Files cần `git add`:**
```
backend/billing-service/src/main/java/com/clinic/billing/repository/InvoiceRepository.java
```

**Lệnh:**
```bash
git add backend/billing-service/src/main/java/com/clinic/billing/repository/
git commit -m "feat(billing): add invoice repository"
```

---

## 4. `feat(billing): add billing dto`

**Files cần `git add`:**
```
backend/billing-service/src/main/java/com/clinic/billing/dto/CreateInvoiceRequest.java
backend/billing-service/src/main/java/com/clinic/billing/dto/InvoiceResponse.java
backend/billing-service/src/main/java/com/clinic/billing/dto/PayInvoiceRequest.java
backend/billing-service/src/main/java/com/clinic/billing/client/AppointmentClient.java
backend/billing-service/src/main/java/com/clinic/billing/client/AppointmentResponse.java
backend/billing-service/src/main/java/com/clinic/billing/client/PatientClient.java
backend/billing-service/src/main/java/com/clinic/billing/client/PatientProfileResponse.java
```

**Lệnh:**
```bash
git add backend/billing-service/src/main/java/com/clinic/billing/dto/ \
        backend/billing-service/src/main/java/com/clinic/billing/client/
git commit -m "feat(billing): add billing dto"
```

---

## 5. `feat(billing): implement create invoice`

**Files cần `git add`:**
```
backend/billing-service/src/main/java/com/clinic/billing/service/BillingService.java
backend/billing-service/src/main/java/com/clinic/billing/service/impl/BillingServiceImpl.java
```
*(phần logic createInvoice trong BillingServiceImpl)*

**Lệnh:**
```bash
git add backend/billing-service/src/main/java/com/clinic/billing/service/
git commit -m "feat(billing): implement create invoice"
```

---

## 6. `feat(billing): implement get invoice`

> [!NOTE]
> Commit 5 và 6 chia sẻ cùng file `BillingService.java` và `BillingServiceImpl.java`.
> Nếu muốn tách riêng, dùng `git add -p` để stage từng hunk (đoạn code) trong file.
> Nếu không cần tách quá chi tiết, có thể gộp commit 5 + 6 thành một.

**Lệnh (nếu tách hunk):**
```bash
git add -p backend/billing-service/src/main/java/com/clinic/billing/service/impl/BillingServiceImpl.java
git commit -m "feat(billing): implement get invoice"
```

---

## 7. `feat(billing): implement invoice status`

> [!NOTE]
> Tương tự, dùng `git add -p` để stage phần logic cập nhật status.

```bash
git add -p backend/billing-service/src/main/java/com/clinic/billing/service/impl/BillingServiceImpl.java
git commit -m "feat(billing): implement invoice status"
```

---

## 8. `feat(billing): implement payment processing`

**Files cần `git add`:**
```
backend/billing-service/src/main/java/com/clinic/billing/controller/BillingController.java
```
*(cùng với phần payInvoice trong BillingServiceImpl nếu chưa stage)*

**Lệnh:**
```bash
git add backend/billing-service/src/main/java/com/clinic/billing/controller/
git commit -m "feat(billing): implement payment processing"
```

---

## 9. `test(billing): add billing api tests`

**Files cần `git add`:**
```
backend/billing-service/src/test/java/com/clinic/billing/service/impl/BillingServiceImplTest.java
```

**Lệnh:**
```bash
git add backend/billing-service/src/test/
git commit -m "test(billing): add billing api tests"
```

---

## 10. `feat(notification): initialize notification service`

**Files cần `git add`:**
```
backend/notification-service/pom.xml
backend/notification-service/src/main/java/com/clinic/notification/NotificationServiceApplication.java
backend/notification-service/src/main/java/com/clinic/notification/config/RabbitMqConfig.java
backend/notification-service/src/main/java/com/clinic/notification/config/NotificationRabbitProperties.java
backend/notification-service/src/main/java/com/clinic/notification/config/SmsNotificationProperties.java
backend/notification-service/src/main/java/com/clinic/notification/security/CurrentUserPrincipal.java
backend/notification-service/src/main/java/com/clinic/notification/security/JwtAuthenticationFilter.java
backend/notification-service/src/main/java/com/clinic/notification/security/JwtProperties.java
backend/notification-service/src/main/java/com/clinic/notification/security/JwtService.java
backend/notification-service/src/main/java/com/clinic/notification/security/SecurityConfig.java
backend/notification-service/src/main/java/com/clinic/notification/exception/GlobalExceptionHandler.java
backend/notification-service/src/main/resources/application.yml
backend/notification-service/src/main/resources/application-local.yml
```

**Lệnh:**
```bash
git add backend/notification-service/pom.xml \
        backend/notification-service/src/main/java/com/clinic/notification/NotificationServiceApplication.java \
        backend/notification-service/src/main/java/com/clinic/notification/config/ \
        backend/notification-service/src/main/java/com/clinic/notification/security/ \
        backend/notification-service/src/main/java/com/clinic/notification/exception/ \
        backend/notification-service/src/main/resources/application.yml \
        backend/notification-service/src/main/resources/application-local.yml
git commit -m "feat(notification): initialize notification service"
```

---

## 11. `feat(notification): add notification entity`

**Files cần `git add`:**
```
backend/notification-service/src/main/java/com/clinic/notification/entity/Notification.java
backend/notification-service/src/main/java/com/clinic/notification/entity/NotificationStatus.java
backend/notification-service/src/main/java/com/clinic/notification/entity/NotificationType.java
backend/notification-service/src/main/resources/db/migration/V1__create_notification_tables.sql
```

**Lệnh:**
```bash
git add backend/notification-service/src/main/java/com/clinic/notification/entity/ \
        backend/notification-service/src/main/resources/db/
git commit -m "feat(notification): add notification entity"
```

---

## 12. `feat(notification): add notification repository`

**Files cần `git add`:**
```
backend/notification-service/src/main/java/com/clinic/notification/repository/NotificationRepository.java
```

**Lệnh:**
```bash
git add backend/notification-service/src/main/java/com/clinic/notification/repository/
git commit -m "feat(notification): add notification repository"
```

---

## 13. `feat(notification): implement create notification`

**Files cần `git add`:**
```
backend/notification-service/src/main/java/com/clinic/notification/dto/NotificationRequest.java
backend/notification-service/src/main/java/com/clinic/notification/dto/NotificationResponse.java
backend/notification-service/src/main/java/com/clinic/notification/dto/NotificationDeliveryMessage.java
backend/notification-service/src/main/java/com/clinic/notification/mapper/NotificationMapper.java
backend/notification-service/src/main/java/com/clinic/notification/service/NotificationService.java
backend/notification-service/src/main/java/com/clinic/notification/service/impl/NotificationServiceImpl.java
```

**Lệnh:**
```bash
git add backend/notification-service/src/main/java/com/clinic/notification/dto/ \
        backend/notification-service/src/main/java/com/clinic/notification/mapper/ \
        backend/notification-service/src/main/java/com/clinic/notification/service/
git commit -m "feat(notification): implement create notification"
```

---

## 14. `feat(notification): implement get notifications`

> [!NOTE]
> Dùng `git add -p` để stage riêng hunk getNotifications trong NotificationServiceImpl nếu cần tách.

```bash
git add -p backend/notification-service/src/main/java/com/clinic/notification/service/impl/NotificationServiceImpl.java
git commit -m "feat(notification): implement get notifications"
```

---

## 15. `feat(notification): implement mark as read`

```bash
git add -p backend/notification-service/src/main/java/com/clinic/notification/service/impl/NotificationServiceImpl.java
git commit -m "feat(notification): implement mark as read"
```

---

## 16. `feat(notification): integrate notification flow`

**Files cần `git add`:**
```
backend/notification-service/src/main/java/com/clinic/notification/controller/NotificationController.java
backend/notification-service/src/main/java/com/clinic/notification/consumer/NotificationDeliveryConsumer.java
backend/notification-service/src/main/java/com/clinic/notification/provider/NotificationProvider.java
backend/notification-service/src/main/java/com/clinic/notification/provider/NotificationProviderResolver.java
backend/notification-service/src/main/java/com/clinic/notification/provider/EmailNotificationProvider.java
backend/notification-service/src/main/java/com/clinic/notification/provider/SmsNotificationProvider.java
```

**Lệnh:**
```bash
git add backend/notification-service/src/main/java/com/clinic/notification/controller/ \
        backend/notification-service/src/main/java/com/clinic/notification/consumer/ \
        backend/notification-service/src/main/java/com/clinic/notification/provider/
git commit -m "feat(notification): integrate notification flow"
```

---

## 17. `test(notification): add notification api tests`

**Files cần `git add`:**
```
backend/notification-service/src/test/java/com/clinic/notification/service/impl/NotificationServiceImplTest.java
backend/notification-service/src/test/java/com/clinic/notification/security/JwtServiceTest.java
```

**Lệnh:**
```bash
git add backend/notification-service/src/test/
git commit -m "test(notification): add notification api tests"
```

---

## 18. `feat(billing-ui): add invoice page`

**Files cần `git add`:**
```
frontend/src/pages/InvoicesPage.tsx
```

**Lệnh:**
```bash
git add frontend/src/pages/InvoicesPage.tsx
git commit -m "feat(billing-ui): add invoice page"
```

---

## 19. `feat(billing-ui): add payment interface`

> [!NOTE]
> Không tìm thấy file riêng biệt cho payment interface — có thể phần này nằm trong `InvoicesPage.tsx` (modal/dialog thanh toán). Nếu đúng, dùng `git add -p` để stage riêng.
> Hoặc nếu bạn chưa tạo file này, hãy tạo thêm ví dụ: `PaymentModal.tsx`.

```bash
# Nếu dùng git add -p:
git add -p frontend/src/pages/InvoicesPage.tsx
git commit -m "feat(billing-ui): add payment interface"
```

---

## 20. `feat(notification-ui): add notification list`

> [!NOTE]
> Không tìm thấy file `NotificationsPage.tsx` hoặc tương tự trong `frontend/src/pages/`.
> Bạn cần tạo thêm file này trước khi commit.
> Gợi ý: `frontend/src/pages/NotificationsPage.tsx`

```bash
git add frontend/src/pages/NotificationsPage.tsx
# Cũng có thể thêm component Sidebar/App.tsx nếu đã thêm route notification
git add frontend/src/app/App.tsx \
        frontend/src/layouts/Sidebar.tsx
git commit -m "feat(notification-ui): add notification list"
```

---

## 21. `feat(notification-ui): add notification status`

> [!NOTE]
> Tương tự commit 20, cần file component hoặc logic mark-as-read trong UI.
> Gợi ý: `frontend/src/layouts/Topbar.tsx` (nếu có notification badge) hoặc component riêng.

```bash
git add frontend/src/layouts/Topbar.tsx
git commit -m "feat(notification-ui): add notification status"
```

---

## Tóm tắt — Danh sách file theo từng commit

| # | Commit message | Files chính |
|---|----------------|-------------|
| 1 | `feat(billing): initialize billing service` | `pom.xml`, `BillingServiceApplication.java`, `config/`, `security/`, `exception/`, `application*.yml` |
| 2 | `feat(billing): add invoice entity` | `entity/Invoice.java`, `entity/InvoiceStatus.java`, `entity/PaymentMethod.java`, `db/migration/V1__*.sql` |
| 3 | `feat(billing): add invoice repository` | `repository/InvoiceRepository.java` |
| 4 | `feat(billing): add billing dto` | `dto/*.java`, `client/*.java` |
| 5 | `feat(billing): implement create invoice` | `service/BillingService.java`, `service/impl/BillingServiceImpl.java` (hunk tạo invoice) |
| 6 | `feat(billing): implement get invoice` | `BillingServiceImpl.java` (hunk get invoice) |
| 7 | `feat(billing): implement invoice status` | `BillingServiceImpl.java` (hunk update status) |
| 8 | `feat(billing): implement payment processing` | `controller/BillingController.java`, `BillingServiceImpl.java` (hunk pay invoice) |
| 9 | `test(billing): add billing api tests` | `test/.../BillingServiceImplTest.java` |
| 10 | `feat(notification): initialize notification service` | `pom.xml`, `NotificationServiceApplication.java`, `config/`, `security/`, `exception/`, `application*.yml` |
| 11 | `feat(notification): add notification entity` | `entity/Notification.java`, `entity/NotificationStatus.java`, `entity/NotificationType.java`, `db/migration/V1__*.sql` |
| 12 | `feat(notification): add notification repository` | `repository/NotificationRepository.java` |
| 13 | `feat(notification): implement create notification` | `dto/*.java`, `mapper/`, `service/NotificationService.java`, `service/impl/NotificationServiceImpl.java` (hunk create) |
| 14 | `feat(notification): implement get notifications` | `NotificationServiceImpl.java` (hunk get) |
| 15 | `feat(notification): implement mark as read` | `NotificationServiceImpl.java` (hunk markAsRead) |
| 16 | `feat(notification): integrate notification flow` | `controller/`, `consumer/`, `provider/` |
| 17 | `test(notification): add notification api tests` | `test/.../NotificationServiceImplTest.java`, `test/.../JwtServiceTest.java` |
| 18 | `feat(billing-ui): add invoice page` | `frontend/src/pages/InvoicesPage.tsx` |
| 19 | `feat(billing-ui): add payment interface` | `InvoicesPage.tsx` (hunk payment modal) hoặc file mới |
| 20 | `feat(notification-ui): add notification list` | `NotificationsPage.tsx` *(cần tạo)*, `App.tsx`, `Sidebar.tsx` |
| 21 | `feat(notification-ui): add notification status` | `Topbar.tsx` hoặc component notification badge *(cần tạo)* |
