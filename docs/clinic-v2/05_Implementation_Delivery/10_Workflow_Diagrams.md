# 10 — Sơ đồ workflow & giao tiếp (Mermaid dạng tài liệu)

Sơ đồ này mô tả **thiết kế dự kiến** để review. Không khẳng định endpoint/service trong V1 đã triển khai. Xem Phase 03 diagrams để có ERD và lifecycle chi tiết.

## A. Phụ thuộc vertical slices
```mermaid
flowchart LR
  S0["S0 Foundation\nTenant, clinic, staff, catalog"] --> S1["S1 Search & Booking"]
  S1 --> S2["S2 Reception & Walk-in"]
  S2 --> S3["S3 Clinical Care"]
  S3 --> S4["S4 Hybrid Billing"]
  S4 --> S5["S5 Portal & Follow-up"]
  S5 --> S6["S6 Full E2E & Pilot Gate"]
  B["Approved deposit thin path\nOD-01/02/03"] -.-> S1
  B -.-> S4
```

## B. Luồng online → khám → thanh toán → tái khám
```mermaid
flowchart TD
  A["Clinic approved and published"] --> B["Patient searches approved clinic"]
  B --> C["Select branch / service / doctor / slot"]
  C --> D["Identify patient and hold slot"]
  D --> E{"Deposit required under approved policy?"}
  E -- No --> F["Atomic booking confirmation"]
  E -- Yes --> G["Billing payment intent: pending"]
  G --> H{"Provider webhook verified and hold active?"}
  H -- Yes --> F
  H -- No / unknown --> X["Pending reconciliation or exception / refund"]
  F --> I["Receptionist check-in + queue ticket"]
  I --> J["Assigned doctor starts encounter"]
  J --> K["Note + clinical order if needed"]
  K --> L["Result returned and doctor reviews"]
  L --> M["Diagnosis + prescription + signed record"]
  M --> N["Bill from unique source charges"]
  N --> O["Direct or verified online final payment"]
  M --> P["Release approved documents"]
  O --> Q["Portal bill/payment history"]
  P --> Q
  Q --> R["Create new follow-up appointment linked to prior encounter"]
```

## C. Walk-in không qua đặt lịch web
```mermaid
sequenceDiagram
  actor P as Patient at desk
  participant R as Receptionist
  participant PS as Patient Service
  participant ES as Encounter Service
  participant M as Medical
  participant B as Billing
  participant Portal as Portal
  P->>R: Present for care; no online account/booking
  R->>PS: Search verified administrative profile
  PS-->>R: Candidate matches for manual review
  R->>PS: Create or link provisional clinic patient
  R->>ES: Create walk-in visit (appointmentId=null)
  ES-->>R: Visit ID and branch queue ticket
  ES-->>M: Check-in event / assigned worklist
  M->>M: Exam; optional order, result, review; sign
  M-->>B: Unique billable source events
  R->>B: Take onsite payment and print correct receipt
  M-->>Portal: Release document reference
  P->>Portal: Verify identity and link account to own records
  Portal-->>P: Only released authorized documents
```

## D. Giao tiếp và tính nhất quán
```mermaid
flowchart LR
  Client["Public / Clinic UI"] --> BFF["BFF/API Gateway"]
  BFF --> C["Clinic + Identity"]
  BFF --> A["Appointment"]
  BFF --> E["Encounter"]
  BFF --> M["Medical"]
  BFF --> F["Billing"]
  C --> Out["Outbox/Event bus"]
  A --> Out
  E --> Out
  M --> Out
  F --> Out
  Out --> S["Search read model"]
  Out --> P["Portal projection"]
  Out --> N["Notification"]
  BFF --> S
  BFF --> P
```

**Ràng buộc quan trọng:** Client không gọi trực tiếp database, BFF không tự xác nhận thanh toán; portal access to document phải authorize ở server của record owner; Search availability chỉ là hint và booking phải revalidate nguồn.

## E. Trạng thái khác nhau của cùng một hành trình
```mermaid
flowchart LR
  AP["Appointment: confirmed"] --> CH["Check-in: done"]
  CH --> EN["Encounter: in progress / awaiting results"]
  EN --> CL["Clinical: signed"]
  CL --> RE["Document: released"]
  EN --> BL["Bill: issued / partially paid / paid"]
  BL --> PM["Payment: pending / verified / refund"]
```

Không ánh xạ tất cả các hộp thành một boolean `completed`: ký hồ sơ, đóng lượt khám, release tài liệu và thanh toán là các chuyển trạng thái độc lập.
