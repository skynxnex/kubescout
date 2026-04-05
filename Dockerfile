FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY gradle gradle
COPY gradlew gradlew
COPY build.gradle.kts build.gradle.kts
COPY settings.gradle.kts settings.gradle.kts
COPY src src
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Set timezone to Europe/Stockholm
ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY --from=build /app/build/libs/*.jar /app/app.jar

# Run as non-root
RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD curl -f http://localhost:8080/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

# Runtime image with AWS CLI v2.
# Needed for local mode when kubeconfig uses AWS exec auth: `aws eks get-token`.
FROM eclipse-temurin:21-jre AS runtime-local

# Set timezone to Europe/Stockholm
ENV TZ=UTC

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip ca-certificates tzdata python3 \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64|amd64) url="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" ;; \
      aarch64|arm64) url="https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" ;; \
      *) echo "Unsupported arch: $arch"; exit 1 ;; \
    esac; \
    curl -sSL "$url" -o /tmp/awscliv2.zip; \
    unzip -q /tmp/awscliv2.zip -d /tmp; \
    /tmp/aws/install; \
    rm -rf /tmp/aws /tmp/awscliv2.zip

RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64|amd64) KUBE_ARCH="amd64" ;; \
      aarch64|arm64) KUBE_ARCH="arm64" ;; \
      *) echo "Unsupported arch: $arch"; exit 1 ;; \
    esac; \
    KUBE_VERSION="v1.31.4"; \
    curl -sSL "https://dl.k8s.io/release/${KUBE_VERSION}/bin/linux/${KUBE_ARCH}/kubectl" -o /usr/local/bin/kubectl; \
    chmod +x /usr/local/bin/kubectl

WORKDIR /app
COPY --from=build /app/build/libs/*.jar /app/app.jar

# Run as non-root (added after all apt/tool installs which require root)
RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

FROM eclipse-temurin:21-jdk AS dev

# Set timezone to Europe/Stockholm
ENV TZ=UTC

# AWS CLI v2 (needed for EKS kubeconfig exec auth: `aws eks get-token`)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip groff less inotify-tools tzdata python3 \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64|amd64) url="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" ;; \
      aarch64|arm64) url="https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" ;; \
      *) echo "Unsupported arch: $arch"; exit 1 ;; \
    esac; \
    curl -sSL "$url" -o /tmp/awscliv2.zip; \
    unzip -q /tmp/awscliv2.zip -d /tmp; \
    /tmp/aws/install; \
    rm -rf /tmp/aws /tmp/awscliv2.zip

RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64|amd64) KUBE_ARCH="amd64" ;; \
      aarch64|arm64) KUBE_ARCH="arm64" ;; \
      *) echo "Unsupported arch: $arch"; exit 1 ;; \
    esac; \
    KUBE_VERSION="v1.31.4"; \
    curl -sSL "https://dl.k8s.io/release/${KUBE_VERSION}/bin/linux/${KUBE_ARCH}/kubectl" -o /usr/local/bin/kubectl; \
    chmod +x /usr/local/bin/kubectl

WORKDIR /app
COPY gradle gradle
COPY gradlew gradlew
COPY build.gradle.kts build.gradle.kts
COPY settings.gradle.kts settings.gradle.kts
COPY src src
COPY src/main/resources/dev/watch-and-run.sh /usr/local/bin/watch-and-run.sh
RUN chmod +x /usr/local/bin/watch-and-run.sh

# ~/.kube and ~/.aws are mounted from host via docker-compose volumes
# This allows live updates when AWS SSO credentials refresh

EXPOSE 8080
