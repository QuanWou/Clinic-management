# Architecture Design

Tài liệu kiến trúc chi tiết đã được tách thành các file chuyên biệt để agent và developer đọc đúng ngữ cảnh trước khi sửa code.

## Canonical Docs

- [Architecture overview](architecture-overview.md): kiến trúc tổng thể, service ownership, request flow, consistency strategy.
- [Project structure](project-structure.md): cấu trúc thư mục, module, package, nơi đặt code mới.
- [Backend service standard](backend-service-standard.md): chuẩn Controller, Service, Repository, DTO, Entity, Exception, Security, Migration, Test.
- [Service interaction guide](service-interaction.md): Feign, JWT propagation, event-driven flow, ownership ID, failure handling.
- [AI system prompt](ai-system-prompt.md): prompt hệ thống dùng cho Claude/Codex/Cursor.

## Current Architecture Summary

Hệ thống dùng kiến trúc microservices theo Maven multi-module:

- `api-gateway`: entry point cho client.
- `identity-service`: auth, user, role, JWT, refresh token.
- `patient-service`: hồ sơ bệnh nhân.
- `doctor-service`: hồ sơ bác sĩ, chuyên khoa, lịch làm việc.
- `appointment-service`: đặt lịch và điều phối khám.
- `medical-record-service`: bệnh án và đơn thuốc.
- `billing-service`: hóa đơn và thanh toán.
- `notification-service`: thông báo.
- `common-lib`: response wrapper, error code, business exception.

Database dùng PostgreSQL theo hướng schema-per-service. Service chỉ sở hữu schema của chính nó, không truy cập trực tiếp schema của service khác.

## Important Notes

- Code hiện tại và gateway đang dùng route `/api/...`.
- Chuẩn dài hạn là `/api/v1/...`, nhưng chỉ migrate khi cập nhật đồng bộ controller, gateway, docs và test.
- OpenFeign, resilience, async messaging và Docker Compose là phần cần hoàn thiện ở các phase sau.
