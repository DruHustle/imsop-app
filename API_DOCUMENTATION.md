# IMSOP API Documentation

**Version:** 2.0.0
**Author:** Andrew Gotora
**Email:** [andrewgotora@yahoo.com](mailto:andrewgotora@yahoo.com)
**Last Updated**: January 9, 2026

## 1. API Overview

The IMSOP API is a RESTful API built with Express.js that provides endpoints for managing users, operations, and telemetry data. All endpoints return JSON responses and require authentication via JWT tokens.

### 1.1 Base URL

```
http://localhost:3001/api
```

### 1.2 Authentication

All API endpoints (except login and register) require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### 1.3 Response Format

All responses follow a consistent JSON format:

**Success Response (2xx)**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

**Error Response (4xx, 5xx)**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400,
  "timestamp": "2024-01-09T12:00:00Z"
}
```

### 1.4 Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error - Server error |

## 2. Authentication Endpoints

### 2.1 User Registration

**Endpoint:** `POST /auth/register`

**Description:** Create a new user account

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Validation Rules:**
- Email must be valid and unique
- Password must be at least 8 characters
- First name and last name are optional

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "status": "active",
    "createdAt": "2024-01-09T12:00:00Z"
  },
  "message": "User created successfully"
}
```

**Error Responses:**
- 400: Invalid email format or password too weak
- 409: Email already exists

### 2.2 User Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticate user and receive JWT token

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user"
    }
  },
  "message": "Login successful"
}
```

**Error Responses:**
- 400: Missing email or password
- 401: Invalid credentials

### 2.3 User Logout

**Endpoint:** `POST /auth/logout`

**Description:** Invalidate current session (client-side token removal recommended)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### 2.4 Get Current User Profile

**Endpoint:** `GET /auth/profile`

**Description:** Retrieve current authenticated user's profile

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "status": "active",
    "createdAt": "2024-01-09T12:00:00Z",
    "updatedAt": "2024-01-09T12:00:00Z"
  }
}
```

**Error Responses:**
- 401: Unauthorized - Invalid or missing token

## 3. Operations Endpoints

### 3.1 Create Operation

**Endpoint:** `POST /operations`

**Description:** Create a new supply chain operation

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Q1 Shipment",
  "description": "First quarter shipment to Asia",
  "location": "Shanghai, China",
  "startDate": "2024-01-15T00:00:00Z",
  "endDate": "2024-01-30T00:00:00Z"
}
```

**Validation Rules:**
- Name is required (max 255 characters)
- Description is optional (max 1000 characters)
- Location is optional
- Start date must be before end date

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Q1 Shipment",
    "description": "First quarter shipment to Asia",
    "location": "Shanghai, China",
    "status": "pending",
    "createdBy": 1,
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-01-30T00:00:00Z",
    "createdAt": "2024-01-09T12:00:00Z",
    "updatedAt": "2024-01-09T12:00:00Z"
  }
}
```

**Error Responses:**
- 400: Invalid request data
- 401: Unauthorized

### 3.2 Get All Operations

**Endpoint:** `GET /operations`

**Description:** Retrieve list of all operations with optional filtering

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
```
?status=pending&page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (pending, in_progress, completed, failed) |
| page | number | Page number (default: 1) |
| limit | number | Results per page (default: 10, max: 100) |
| sortBy | string | Sort field (name, status, createdAt) |
| sortOrder | string | Sort order (asc, desc) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "operations": [
      {
        "id": 1,
        "name": "Q1 Shipment",
        "description": "First quarter shipment to Asia",
        "location": "Shanghai, China",
        "status": "in_progress",
        "createdBy": 1,
        "startDate": "2024-01-15T00:00:00Z",
        "endDate": "2024-01-30T00:00:00Z",
        "createdAt": "2024-01-09T12:00:00Z",
        "updatedAt": "2024-01-09T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

**Error Responses:**
- 401: Unauthorized

### 3.3 Get Operation by ID

**Endpoint:** `GET /operations/:id`

**Description:** Retrieve specific operation details

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
- id (required): Operation ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Q1 Shipment",
    "description": "First quarter shipment to Asia",
    "location": "Shanghai, China",
    "status": "in_progress",
    "createdBy": 1,
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-01-30T00:00:00Z",
    "createdAt": "2024-01-09T12:00:00Z",
    "updatedAt": "2024-01-09T12:00:00Z"
  }
}
```

**Error Responses:**
- 401: Unauthorized
- 404: Operation not found

### 3.4 Update Operation

**Endpoint:** `PUT /operations/:id`

**Description:** Update operation details

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
- id (required): Operation ID

**Request Body:**
```json
{
  "name": "Q1 Shipment - Updated",
  "status": "completed",
  "endDate": "2024-01-28T00:00:00Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Q1 Shipment - Updated",
    "description": "First quarter shipment to Asia",
    "location": "Shanghai, China",
    "status": "completed",
    "createdBy": 1,
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-01-28T00:00:00Z",
    "createdAt": "2024-01-09T12:00:00Z",
    "updatedAt": "2024-01-09T12:15:00Z"
  }
}
```

**Error Responses:**
- 400: Invalid request data
- 401: Unauthorized
- 403: Forbidden - User doesn't own operation
- 404: Operation not found

### 3.5 Delete Operation

**Endpoint:** `DELETE /operations/:id`

**Description:** Delete operation and associated data

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
- id (required): Operation ID

**Response (200):**
```json
{
  "success": true,
  "message": "Operation deleted successfully"
}
```

**Error Responses:**
- 401: Unauthorized
- 403: Forbidden - User doesn't own operation
- 404: Operation not found

## 4. Telemetry Endpoints

### 4.1 Create Telemetry Record

**Endpoint:** `POST /telemetry`

**Description:** Record telemetry data for an operation

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "operationId": 1,
  "metricName": "temperature",
  "metricValue": 22.5,
  "unit": "celsius",
  "timestamp": "2024-01-09T12:00:00Z"
}
```

**Validation Rules:**
- operationId is required and must exist
- metricName is required (max 255 characters)
- metricValue is required (number)
- unit is optional (max 50 characters)
- timestamp is required (ISO 8601 format)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "operationId": 1,
    "metricName": "temperature",
    "metricValue": 22.5,
    "unit": "celsius",
    "timestamp": "2024-01-09T12:00:00Z",
    "createdAt": "2024-01-09T12:00:00Z"
  }
}
```

**Error Responses:**
- 400: Invalid request data
- 401: Unauthorized
- 404: Operation not found

### 4.2 Get Telemetry Data

**Endpoint:** `GET /telemetry`

**Description:** Retrieve telemetry data with filtering options

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
```
?operationId=1&metricName=temperature&startDate=2024-01-01&endDate=2024-01-31&page=1&limit=100
```

| Parameter | Type | Description |
|-----------|------|-------------|
| operationId | number | Filter by operation ID |
| metricName | string | Filter by metric name |
| startDate | string | Start date (ISO 8601) |
| endDate | string | End date (ISO 8601) |
| page | number | Page number (default: 1) |
| limit | number | Results per page (default: 100, max: 1000) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "telemetry": [
      {
        "id": 1,
        "operationId": 1,
        "metricName": "temperature",
        "metricValue": 22.5,
        "unit": "celsius",
        "timestamp": "2024-01-09T12:00:00Z",
        "createdAt": "2024-01-09T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 500,
      "totalPages": 5
    }
  }
}
```

**Error Responses:**
- 401: Unauthorized

### 4.3 Get Telemetry Analytics

**Endpoint:** `GET /telemetry/analytics`

**Description:** Get aggregated analytics for telemetry data

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
```
?operationId=1&metricName=temperature&startDate=2024-01-01&endDate=2024-01-31
```

| Parameter | Type | Description |
|-----------|------|-------------|
| operationId | number | Operation ID (required) |
| metricName | string | Metric name (required) |
| startDate | string | Start date (ISO 8601) |
| endDate | string | End date (ISO 8601) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "metricName": "temperature",
    "unit": "celsius",
    "count": 500,
    "average": 22.3,
    "minimum": 18.5,
    "maximum": 26.8,
    "standardDeviation": 2.1,
    "trend": "stable",
    "anomalies": 2,
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z"
  }
}
```

**Error Responses:**
- 400: Missing required parameters
- 401: Unauthorized
- 404: Operation not found

## 5. Health Check Endpoint

### 5.1 Server Health

**Endpoint:** `GET /health`

**Description:** Check server health status (no authentication required)

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-09T12:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

## 6. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_EMAIL | 400 | Email format is invalid |
| PASSWORD_TOO_WEAK | 400 | Password doesn't meet security requirements |
| EMAIL_EXISTS | 409 | Email already registered |
| INVALID_CREDENTIALS | 401 | Email or password is incorrect |
| UNAUTHORIZED | 401 | Missing or invalid authentication token |
| FORBIDDEN | 403 | User doesn't have permission |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Request validation failed |
| SERVER_ERROR | 500 | Internal server error |

## 7. Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default Limit:** 100 requests per minute per IP
- **Authentication Endpoints:** 10 requests per minute
- **Telemetry Endpoints:** 1000 requests per minute

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641732000
```

When rate limit is exceeded, the API returns 429 (Too Many Requests):

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "status": 429,
  "retryAfter": 60
}
```

## 8. Pagination

List endpoints support pagination with the following parameters:

- **page:** Page number (default: 1, minimum: 1)
- **limit:** Results per page (default: 10, maximum: 100)

Pagination metadata is included in responses:

```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 250,
    "totalPages": 25
  }
}
```

## 9. Filtering & Sorting

List endpoints support filtering and sorting:

**Filtering:**
```
GET /operations?status=completed&location=Shanghai
```

**Sorting:**
```
GET /operations?sortBy=createdAt&sortOrder=desc
```

Supported sort fields vary by endpoint and are documented in each endpoint's description.

## 10. Versioning

The API uses URL versioning. Current version is v1:

```
http://localhost:3001/api/v1/operations
```

Future versions will be available at:
```
http://localhost:3001/api/v2/operations
```

## 11. CORS Configuration

The API supports Cross-Origin Resource Sharing (CORS) for the following origins:

- http://localhost:3000
- http://localhost:5173
- https://imsop.example.com

Custom origins can be configured via environment variables.

## 12. Webhook Support

The API supports webhooks for real-time event notifications:

**Supported Events:**
- operation.created
- operation.updated
- operation.deleted
- operation.status_changed
- telemetry.recorded
- alert.triggered

**Webhook Configuration:**
```json
{
  "url": "https://example.com/webhooks/operations",
  "events": ["operation.created", "operation.updated"],
  "active": true
}
```

## 13. Example Requests

### Login and Get Operations

```bash
# 1. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'

# Response includes token
# "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Get operations using token
curl -X GET http://localhost:3001/api/operations \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Create and Update Operation

```bash
# 1. Create operation
curl -X POST http://localhost:3001/api/operations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q1 Shipment",
    "description": "First quarter shipment",
    "location": "Shanghai"
  }'

# 2. Update operation
curl -X PUT http://localhost:3001/api/operations/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

### Record and Retrieve Telemetry

```bash
# 1. Record telemetry
curl -X POST http://localhost:3001/api/telemetry \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "operationId": 1,
    "metricName": "temperature",
    "metricValue": 22.5,
    "unit": "celsius",
    "timestamp": "2024-01-09T12:00:00Z"
  }'

# 2. Get telemetry data
curl -X GET "http://localhost:3001/api/telemetry?operationId=1&metricName=temperature" \
  -H "Authorization: Bearer <token>"

# 3. Get analytics
curl -X GET "http://localhost:3001/api/telemetry/analytics?operationId=1&metricName=temperature" \
  -H "Authorization: Bearer <token>"
```
