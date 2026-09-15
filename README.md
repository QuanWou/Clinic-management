# Clinic Management System

## Overview
Micro-service based platform for managing clinics. Built with **Java 21**, **Spring Boot 3**, **PostgreSQL**, and **Docker Compose**. Includes implemented identity, patient, doctor, appointment, medical record, billing, and notification service foundations.

## Architecture Docs
- [Root system prompt](system_prompt.md)
- [AI system prompt](docs/ai-system-prompt.md)
- [Architecture overview](docs/architecture-overview.md)
- [Backend service standard](docs/backend-service-standard.md)
- [Project structure](docs/project-structure.md)
- [Service interaction guide](docs/service-interaction.md)
- [API contract](docs/api-contract.md)
- [ERD](docs/erd.md)
- [Roadmap](docs/roadmap.md)

## Quick Start (dev)
```bash
# Start PostgreSQL, backend services, API Gateway, Prometheus, and Grafana
docker compose up --build

# Verify all backend modules
cd backend
mvn clean test
```

Local URLs:

- API Gateway: `http://localhost:8090`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (`admin` / `admin`)

Stop the stack:

```bash
docker compose down
```
