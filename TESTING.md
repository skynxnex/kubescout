# Testing Guide

## Backend Tests

Backend tests are written with JUnit 5, MockK, and AssertJ.

**Run backend tests:**
```bash
docker compose exec kss-dev mvn test
```

**Test Coverage:**
- `RateLimiterTest` - 5 tests for rate limiting logic
- `MetricsCacheTest` - 5 tests for caching with TTL
- `DashboardViewRendererTest` - 5 tests for HTML rendering

Total: **15 backend tests**

## Frontend Tests

Frontend tests are simple Node.js scripts testing utility functions.

**Run frontend tests:**
```bash
yarn test:frontend
```

**Test Coverage:**
- Formatting functions (formatAge, formatCpuPercent, formatMemPercent, etc.)
- HTML escaping for XSS prevention

Total: **20 frontend tests**

## Running All Tests

```bash
# Backend
docker compose exec kss-dev mvn test

# Frontend
yarn test:frontend
```

## Test Philosophy

- **Backend:** Comprehensive unit tests with mocking for external dependencies
- **Frontend:** Simple, focused tests for utility functions
- **No E2E:** Dashboard is tested manually in local development
