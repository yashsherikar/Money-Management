FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
# Render free tier = tiny shared CPU + 512MB. These cut cold-start time (was ~4 min):
# C1-only JIT starts much faster, SerialGC avoids spinning up GC threads we can't use.
ENTRYPOINT ["java", "-XX:TieredStopAtLevel=1", "-XX:+UseSerialGC", "-Xss512k", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
