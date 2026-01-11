# IMSOP Design Document

**Version:** 1.0.0  
**Author:** Andrew Gotora  
**Email:** andrewgotora@yahoo.com

## 1. System Architecture

### 1.1 High-Level Architecture

The IMSOP platform follows a modern three-tier architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (React)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages │ Components │ Hooks │ Context │ Services    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST API
┌────────────────────────▼────────────────────────────────────┐
│                   API Layer (Express)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routes │ Controllers │ Middleware │ Validation      │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ SQL Queries
┌────────────────────────▼────────────────────────────────────┐
│                 Data Layer (Drizzle ORM)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Database Schema │ Migrations │ Queries              │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Database (MySQL/PostgreSQL)                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Architecture

#### Frontend Components

The frontend follows a component-based architecture with clear responsibilities:

**Page Components**
- Dashboard: Main landing page with overview
- Operations: Operations management interface
- Telemetry: Telemetry data visualization
- Maps: Geospatial visualization
- Settings: User and system settings

**Functional Components**
- Navigation: Header and sidebar navigation
- Forms: Input forms for data entry
- Charts: Data visualization components
- Tables: Data display and management
- Modals: Dialog and modal components

**UI Components (Radix UI)**
- Buttons, inputs, selects
- Cards, dialogs, dropdowns
- Tabs, tooltips, popovers
- Progress bars, sliders

#### Backend Services

**Authentication Service**
- User registration and login
- JWT token generation and validation
- Password hashing and verification
- Session management

**Operations Service**
- CRUD operations for supply chain operations
- Operation status tracking
- Performance metrics calculation
- Data validation and business logic

**Telemetry Service**
- Data collection and storage
- Real-time data processing
- Analytics and aggregation
- Historical data management

**Database Service**
- Connection pooling
- Query execution
- Transaction management
- Schema management

## 2. SOLID Principles Implementation

### 2.1 Single Responsibility Principle

Each module has a single, well-defined responsibility:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Implement business logic
- **Models**: Define data structures
- **Routes**: Define API endpoints
- **Middleware**: Handle cross-cutting concerns

Example:
```typescript
// ✓ Good: Single responsibility
class AuthController {
  async login(req, res) { /* handle login */ }
  async logout(req, res) { /* handle logout */ }
}

class AuthService {
  async validateCredentials(email, password) { /* validation */ }
  async generateToken(user) { /* token generation */ }
}

// ✗ Bad: Multiple responsibilities
class AuthController {
  async login(req, res) {
    // Validation, database query, token generation, response
  }
}
```

### 2.2 Open/Closed Principle

The system is open for extension but closed for modification:

- **Middleware Stack**: New middleware can be added without modifying existing code
- **Route Handlers**: New routes can be added without changing core logic
- **Component Library**: New components can be created by extending base components
- **Service Layer**: New services can be added without modifying existing services

### 2.3 Liskov Substitution Principle

All implementations follow consistent interfaces:

- **Controllers**: All follow the same request/response pattern
- **Services**: All implement consistent method signatures
- **Components**: All follow React component conventions
- **Middleware**: All follow Express middleware pattern

### 2.4 Interface Segregation Principle

Interfaces are focused and minimal:

```typescript
// ✓ Good: Segregated interfaces
interface IAuthService {
  login(email: string, password: string): Promise<User>;
  logout(userId: string): Promise<void>;
}

interface ITokenService {
  generateToken(user: User): string;
  validateToken(token: string): User | null;
}

// ✗ Bad: Fat interface
interface IAuthService {
  login(): Promise<User>;
  logout(): Promise<void>;
  register(): Promise<User>;
  generateToken(): string;
  validateToken(): User;
  hashPassword(): string;
  sendEmail(): void;
}
```

### 2.5 Dependency Inversion Principle

High-level modules depend on abstractions, not low-level details:

- **Controllers** depend on service interfaces, not implementations
- **Services** depend on repository interfaces, not database directly
- **Components** depend on context providers, not direct state
- **Routes** depend on controller interfaces, not implementations

## 3. Database Schema

### 3.1 Core Entities

#### Users Table
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Operations Table
```sql
CREATE TABLE operations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
  created_by INT NOT NULL,
  location VARCHAR(255),
  start_date DATETIME,
  end_date DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### Telemetry Table
```sql
CREATE TABLE telemetry (
  id INT PRIMARY KEY AUTO_INCREMENT,
  operation_id INT NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  metric_value FLOAT NOT NULL,
  unit VARCHAR(50),
  timestamp DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operation_id) REFERENCES operations(id),
  INDEX idx_operation_timestamp (operation_id, timestamp)
);
```

### 3.2 Relationships

- **Users → Operations**: One-to-Many (creator)
- **Operations → Telemetry**: One-to-Many
- **Users → Sessions**: One-to-Many (implicit via JWT)

## 4. API Design

### 4.1 RESTful Principles

The API follows RESTful conventions:

- **Resources** are represented by nouns (users, operations, telemetry)
- **HTTP Methods** indicate operations (GET, POST, PUT, DELETE)
- **Status Codes** indicate results (200, 201, 400, 401, 404, 500)
- **JSON** is used for request/response bodies

### 4.2 Authentication

JWT-based authentication with the following flow:

1. User provides credentials
2. Server validates and generates JWT token
3. Client includes token in Authorization header
4. Server validates token on each request
5. Token expires after configured duration

### 4.3 Error Handling

Consistent error response format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400,
  "timestamp": "2024-01-09T12:00:00Z"
}
```

## 5. Frontend Architecture

### 5.1 State Management

The frontend uses React Context API for state management:

- **AuthContext**: User authentication state
- **OperationsContext**: Operations data and filters
- **TelemetryContext**: Telemetry data and analytics
- **UIContext**: UI state (modals, notifications, etc.)

### 5.2 Component Hierarchy

```
App
├── AuthProvider
│   ├── OperationsProvider
│   │   ├── TelemetryProvider
│   │   │   ├── Layout
│   │   │   │   ├── Header
│   │   │   │   ├── Sidebar
│   │   │   │   └── MainContent
│   │   │   │       ├── Dashboard
│   │   │   │       ├── Operations
│   │   │   │       ├── Telemetry
│   │   │   │       └── Maps
│   │   │   └── Footer
```

### 5.3 Routing

Routes are defined using Wouter with the following structure:

- `/` - Dashboard
- `/operations` - Operations list
- `/operations/:id` - Operation details
- `/telemetry` - Telemetry data
- `/maps` - Geospatial visualization
- `/settings` - User settings
- `/login` - Login page
- `/register` - Registration page

## 6. Backend Architecture

### 6.1 Request Flow

```
HTTP Request
    ↓
Express Middleware (CORS, JSON parsing)
    ↓
Route Handler
    ↓
Authentication Middleware
    ↓
Controller
    ↓
Service Layer (Business Logic)
    ↓
Repository/ORM Layer
    ↓
Database
    ↓
Response
```

### 6.2 Error Handling

Centralized error handling with custom error classes:

```typescript
class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public status: number
  ) {
    super(message);
  }
}

// Usage
throw new AppError('User not found', 'USER_NOT_FOUND', 404);
```

### 6.3 Validation

Input validation using Zod schemas:

```typescript
const createOperationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  location: z.string().optional(),
});

// Usage
const validated = createOperationSchema.parse(req.body);
```

## 7. Data Flow

### 7.1 User Authentication Flow

```
User Input (Email, Password)
    ↓
Frontend validates input
    ↓
POST /api/auth/login
    ↓
Backend validates credentials
    ↓
Backend generates JWT token
    ↓
Frontend stores token in localStorage
    ↓
Frontend redirects to dashboard
    ↓
Frontend includes token in subsequent requests
```

### 7.2 Operations Data Flow

```
User requests operations list
    ↓
GET /api/operations
    ↓
Backend retrieves from database
    ↓
Backend applies filters and sorting
    ↓
Backend returns JSON response
    ↓
Frontend updates state
    ↓
Frontend renders operations list
    ↓
User interacts with operations
```

### 7.3 Telemetry Data Flow

```
IoT Device sends data
    ↓
POST /api/telemetry
    ↓
Backend validates data
    ↓
Backend stores in database
    ↓
Backend triggers analytics
    ↓
Frontend polls for updates
    ↓
Frontend updates charts and visualizations
```

## 8. Security Considerations

### 8.1 Authentication & Authorization

- JWT tokens for stateless authentication
- Password hashing with bcryptjs
- Role-based access control (RBAC)
- Token expiration and refresh mechanisms

### 8.2 Data Protection

- HTTPS/TLS for all communications
- SQL injection prevention via parameterized queries
- XSS prevention through React's built-in escaping
- CSRF protection via SameSite cookies

### 8.3 API Security

- CORS configuration for allowed origins
- Rate limiting for API endpoints
- Input validation and sanitization
- Error messages don't expose sensitive information

## 9. Performance Optimization

### 9.1 Frontend Optimization

- Code splitting with dynamic imports
- Component memoization for expensive renders
- Lazy loading of routes and components
- Efficient state management to prevent unnecessary re-renders
- Image optimization and compression

### 9.2 Backend Optimization

- Database query optimization with indexes
- Connection pooling for database connections
- Caching strategies for frequently accessed data
- Pagination for large result sets
- Compression of API responses

### 9.3 Infrastructure Optimization

- CDN for static assets
- Load balancing across multiple instances
- Database replication for high availability
- Kubernetes auto-scaling based on load

## 10. Testing Strategy

### 10.1 Unit Tests

Test individual functions and components in isolation:

- Service functions
- Component rendering
- Hook behavior
- Utility functions

### 10.2 Integration Tests

Test interactions between components:

- API endpoint testing
- Component integration
- Database operations
- Authentication flow

### 10.3 E2E Tests

Test complete user workflows:

- Login flow
- Creating operations
- Viewing telemetry data
- Navigation between pages

## 11. Deployment Architecture

### 11.1 Development Environment

- Local development with hot reload
- Mock data for testing
- Local database instance

### 11.2 Staging Environment

- Pre-production testing
- Real database with test data
- Performance testing
- Security testing

### 11.3 Production Environment

- Kubernetes cluster
- Load balancing
- Database replication
- Monitoring and logging
- Backup and disaster recovery

## 12. Monitoring & Logging

### 12.1 Application Logging

- Request/response logging
- Error logging with stack traces
- Performance metrics
- User activity tracking

### 12.2 Infrastructure Monitoring

- CPU and memory usage
- Database performance
- API response times
- Error rates and exceptions

### 12.3 Alerting

- Critical error alerts
- Performance degradation alerts
- Security incident alerts
- Resource exhaustion alerts
