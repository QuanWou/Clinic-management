FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml ./
COPY common-lib/pom.xml common-lib/pom.xml
COPY api-gateway/pom.xml api-gateway/pom.xml
COPY identity-service/pom.xml identity-service/pom.xml
COPY patient-service/pom.xml patient-service/pom.xml
COPY doctor-service/pom.xml doctor-service/pom.xml
COPY catalog-service/pom.xml catalog-service/pom.xml
COPY appointment-service/pom.xml appointment-service/pom.xml
COPY medical-record-service/pom.xml medical-record-service/pom.xml
COPY billing-service/pom.xml billing-service/pom.xml
COPY notification-service/pom.xml notification-service/pom.xml

ARG MODULE

COPY . .
RUN --mount=type=cache,target=/root/.m2,sharing=locked mvn -pl ${MODULE} -am clean install -DskipTests
RUN --mount=type=cache,target=/root/.m2,sharing=locked mvn -pl ${MODULE} package org.springframework.boot:spring-boot-maven-plugin:3.3.5:repackage -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app
ARG MODULE
COPY --from=build /workspace/${MODULE}/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
