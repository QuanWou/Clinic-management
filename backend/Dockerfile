FROM maven:3.9-eclipse-temurin-21 AS build
ARG SERVICE
WORKDIR /workspace
COPY . .
RUN test -n "$SERVICE" && mvn -B -pl "$SERVICE" -am -DskipTests install && mvn -B -f "$SERVICE/pom.xml" -DskipTests spring-boot:repackage
RUN cp "$SERVICE"/target/*.jar /service.jar
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /service.jar /app/service.jar
USER 10001
ENTRYPOINT ["java", "-jar", "/app/service.jar"]
