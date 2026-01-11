# IMSOP - Intelligent Multi-Cloud Supply Chain & Operations Platform

**Version:** 1.0.0  
**Author:** Andrew Gotora  
**Email:** andrewgotora@yahoo.com

## 🚀 Quick Links

- [Live Demo](https://imsop-app.onrender.com/) - View the live demo
- [GitHub Repository](https://github.com/DruHustle/imsop-app) - View source code
- [Issues](https://github.com/DruHustle/imsop-app/issues) - Report bugs or request features

## Overview

IMSOP is an enterprise-grade platform designed for real-time supply chain visibility, operational analytics, and multi-cloud infrastructure management. The platform provides comprehensive tools for monitoring operations, managing telemetry data, and gaining actionable insights through advanced analytics.

## Key Features

### Real-time Operations Monitoring
Monitor supply chain operations in real-time with live dashboards and alerts. Track shipments, inventory levels, and operational metrics across multiple locations and cloud providers.

### Advanced Telemetry Collection
Collect and analyze telemetry data from various sources including IoT devices, sensors, and operational systems. Process high-volume data streams with minimal latency.

### Multi-Cloud Infrastructure Management
Manage resources and deployments across multiple cloud providers including Azure, AWS, and on-premise infrastructure through unified Kubernetes orchestration.

### Interactive Mapping & Geospatial Analytics
Visualize supply chain networks, shipment routes, and operational locations using Google Maps integration with real-time tracking capabilities.

### User Authentication & Authorization
Secure access control with JWT-based authentication, role-based access control (RBAC), and comprehensive user management.

### Analytics & Reporting
Generate detailed reports on operational performance, supply chain efficiency, and key performance indicators (KPIs) with customizable dashboards.

## Technology Stack

### Frontend
- **Framework:** React 19.2.1 with TypeScript
- **Build Tool:** Vite 7.1.7
- **Styling:** Tailwind CSS 4.1.14
- **UI Components:** Radix UI with shadcn/ui patterns
- **State Management:** React Context API
- **Routing:** Wouter 3.7.1
- **Forms:** React Hook Form with Zod validation
- **Charts:** Recharts 2.15.2
- **Animations:** Framer Motion 12.23.22
- **HTTP Client:** Axios 1.12.0
- **Testing:** Vitest 2.1.4, Playwright 1.57.0

### Backend & Infrastructure
- **Backend Framework:** Node.js with Express
- **Backend Hosting:** Render (https://render.com)
- **Database:** MySQL with Aiven (https://aiven.io)
- **ORM:** Drizzle ORM
- **Authentication:** JWT-based REST API
- **Frontend Hosting:** GitHub Pages

### Backend
- **Runtime:** Node.js (v22+)
- **Framework:** Express 5.2.1
- **Language:** TypeScript 5.9.3
- **ORM:** Drizzle ORM 0.45.1
- **Database:** MySQL/PostgreSQL compatible
- **Authentication:** JWT (jsonwebtoken 9.0.3)
- **Password Hashing:** bcryptjs 3.0.3
- **CORS:** cors 2.8.5
- **Validation:** Zod 4.3.5

### Infrastructure
- **Container Orchestration:** Kubernetes
- **Infrastructure as Code:** Terraform (Azure)
- **Cloud Providers:** Azure (AKS), AWS, On-premise
- **CI/CD:** GitHub Actions
- **Package Manager:** PNPM 10.4.1

## Project Structure

```
imsop-app/
├── client/                      # Frontend React application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   └── ui/              # Radix UI component library
│   │   ├── contexts/            # React Context providers
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utility functions and helpers
│   │   ├── pages/               # Page components
│   │   ├── __tests__/           # Component tests
│   │   ├── App.tsx              # Main application component
│   │   ├── main.tsx             # Entry point
│   │   └── index.css            # Global styles
│   ├── public/                  # Static assets
│   └── index.html               # HTML template
│
├── server/                      # Backend Node.js application
│   ├── src/
│   │   ├── config/              # Configuration files
│   │   │   └── db.ts            # Database connection
│   │   ├── controllers/         # Request handlers
│   │   │   ├── authController.ts
│   │   │   ├── operationsController.ts
│   │   │   └── telemetryController.ts
│   │   ├── middleware/          # Express middleware
│   │   │   └── auth.ts          # Authentication middleware
│   │   ├── models/              # Database models
│   │   │   └── schema.ts        # Drizzle ORM schema
│   │   ├── routes/              # API routes
│   │   ├── services/            # Business logic
│   │   └── index.ts             # Server entry point
│   ├── drizzle.config.ts        # Drizzle ORM configuration
│   └── tsconfig.json            # TypeScript configuration
│
├── infrastructure/              # Infrastructure as Code
│   ├── terraform/               # Terraform configurations
│   ├── kubernetes/              # Kubernetes manifests
│   └── docker/                  # Docker configurations
│
├── e2e/                         # End-to-end tests
├── docs/                        # Documentation files
├── package.json                 # Project dependencies
├── tsconfig.json                # Root TypeScript configuration
├── vite.config.mts              # Vite configuration
└── README.md                    # This file
```

## Additional Resources

- [Design Document](./DESIGN_DOCUMENT.md) - System architecture and design patterns
- [Requirements Specifications](./REQUIREMENTS_SPECIFICATIONS.md) - Functional and non-functional requirements
- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [System Diagrams](./SYSTEM_DIAGRAMS.md) - Architecture and data flow diagrams
- [Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Step-by-step implementation instructions
- [Architecture Documentation](./ARCHITECTURE_DOCUMENTATION.md) - Professional architecture diagrams and specifications

## 🛠️ Development Setup

### Prerequisites
- Node.js v22 or higher
- MySQL 8.0 or higher
- PNPM 10.4.1 or higher
- Git

### Quick Start (Development)

```bash
# 1. Set up development database
./setup-dev-db.sh

# 2. Copy environment file
cp .env.dev .env

# 3. Install dependencies
pnpm install

# 4. Start development server
pnpm dev
```

The application will be available at `http://localhost:5173` (frontend) and `http://localhost:3000` (backend).

### Database Setup Scripts

#### Development Database
```bash
./setup-dev-db.sh
```

Creates `imsop_dev` database with:
- **Demo Users:**
  - Admin: `admin@demo.local` / `demo-admin-password`
  - Operator: `operator@demo.local` / `demo-operator-password`
  - Analyst: `analyst@demo.local` / `demo-analyst-password`
  - Demo: `demo@demo.local` / `demo-password`
- **Sample Data:**
  - 5 sample shipments
  - 5 sample orders
  - 8 telemetry readings
  - 4 analytics events

#### Test Database
```bash
./setup-test-db.sh
```

Creates `imsop_test` database for running tests.

### Custom Database Credentials

You can customize database credentials by setting environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=your_user
export DB_PASSWORD=your_password
./setup-dev-db.sh
```

### Demo Accounts

The login page includes quick-fill buttons for demo accounts:

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Admin | admin@demo.local | demo-admin-password | admin |
| Operator | operator@demo.local | demo-operator-password | user |
| Analyst | analyst@demo.local | demo-analyst-password | analyst |
| Demo | demo@demo.local | demo-password | user |

Click any demo account button on the login page to auto-fill credentials.

### Environment Variables
Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Then configure the following variables:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=imsop_dev

# API Configuration
API_PORT=3000
API_HOST=localhost

# Google Maps API (Optional - for map visualization)
# Get your API key from: https://console.cloud.google.com/google/maps-apis
# Required APIs: Maps JavaScript API, Places API, Geocoding API, Geometry API
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here

# Authentication
JWT_SECRET=dev-secret-key-change-in-production

# CORS Configuration
CORS_ORIGINS=*

# Logging
LOG_LEVEL=debug
```

**Note:** The Google Maps API key is optional. If not configured, the map component will display a placeholder message. The rest of the application will function normally.`

### Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm dev:client       # Start frontend only
pnpm dev:server       # Start backend only

# Building
pnpm build            # Build for production
pnpm build:client     # Build frontend only
pnpm build:server     # Build backend only

# Testing
pnpm test             # Run test suite
pnpm test:watch       # Run tests in watch mode
pnpm test:ui          # Run tests with UI

# Code Quality
pnpm check            # TypeScript type checking
pnpm lint             # Run ESLint
pnpm format           # Format code with Prettier

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run database migrations
pnpm db:push          # Push schema changes to database

# Production
pnpm start            # Start production server
./deploy.sh           # Automated deployment script
```

### Troubleshooting

**MySQL Connection Error**
```bash
# Ensure MySQL is running
sudo service mysql start

# Check MySQL status
sudo service mysql status

# Verify credentials
mysql -h localhost -u root -p
```

**Port Already in Use**
```bash
# Change port in .env
API_PORT=3001

# Or kill process using port
lsof -ti:3000 | xargs kill -9
```

**Database Setup Issues**
```bash
# Reset database
mysql -u root -p -e "DROP DATABASE imsop_dev;"
./setup-dev-db.sh
```

### Deployment Options

**Development:**
- Local Node.js server with local MySQL database
- Run `./deploy.sh` for automated setup

**Production:**
- Backend: Render (https://render.com)
- Database: Aiven MySQL (https://aiven.io)
- Frontend: GitHub Pages (automatic)
- See `RENDER_DEPLOYMENT.md` for detailed deployment instructions

### Next Steps

1. Review [Architecture Documentation](./ARCHITECTURE_DOCUMENTATION.md)
2. Check [API Documentation](./API_DOCUMENTATION.md)
3. Read [Implementation Guide](./IMPLEMENTATION_GUIDE.md)
4. Explore [System Diagrams](./SYSTEM_DIAGRAMS.md)
5. Follow [Render Deployment Guide](./RENDER_DEPLOYMENT.md) for production setup

## 🚀 Production Deployment

### Using Deploy Script
```bash
export DATABASE_URL="mysql://user:password@host:port/db"
export JWT_SECRET="your-secret-key"
./deploy.sh
```

### Manual Deployment
```bash
# 1. Build application
pnpm build

# 2. Set environment variables
export NODE_ENV=production
export DATABASE_URL="mysql://..."
export JWT_SECRET="..."

# 3. Start server
pnpm start
```

### Configuring Google Maps API for Production (GitHub Pages)

The Google Maps integration is optional but enhances the dashboard with interactive map visualizations.

#### Step 1: Get Google Maps API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/google/maps-apis
   - Create a new project or select an existing one

2. **Enable Required APIs**
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Geometry API

3. **Create API Key**
   - Go to Credentials → Create Credentials → API key
   - Copy the generated API key (format: `AIzaSyC...`)

4. **Restrict API Key (Recommended)**
   - Under "Application restrictions", select "HTTP referrers"
   - Add: `https://druhustle.github.io/*`
   - Under "API restrictions", select the 4 APIs above
   - Click "Save"

#### Step 2: Add to GitHub Repository Secrets

1. **Navigate to Repository Settings**
   - Go to: https://github.com/DruHustle/imsop-app/settings/secrets/actions

2. **Create New Secret**
   - Click "New repository secret"
   - Name: `VITE_GOOGLE_MAPS_API_KEY` (must be exact)
   - Secret: Paste your Google Maps API key
   - Click "Add secret"

#### Step 3: Deploy

The GitHub Actions workflow is already configured to use the secret during build.

**Automatic Deployment:**
- Any push to `main` branch will trigger deployment with the API key

**Manual Deployment:**
1. Go to: https://github.com/DruHustle/imsop-app/actions
2. Click "Deploy to GitHub Pages"
3. Click "Run workflow"

#### Step 4: Verify

1. Wait for deployment to complete (~2-3 minutes)
2. Visit: https://druhustle.github.io/imsop-app/
3. Log in and check the Dashboard
4. The "Global Activity Map" should now show an interactive map

#### Troubleshooting

**Map still shows placeholder:**
- Verify secret name is exactly `VITE_GOOGLE_MAPS_API_KEY`
- Check that all 4 APIs are enabled in Google Cloud Console
- Ensure `https://druhustle.github.io/*` is in HTTP referrers
- Check GitHub Actions logs for build errors

**"This page can't load Google Maps correctly":**
- Set up billing in Google Cloud Console (free tier: $200/month credit)
- Verify API key restrictions aren't too strict

**For Local Development:**
Create a `.env` file:
```bash
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Note:** The application works perfectly without the API key - you'll just see a placeholder message instead of the interactive map.

## 📝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📧 Support

For support, email andrewgotora@yahoo.com or open an issue on GitHub.

## 🙏 Acknowledgments

- Built with React, Node.js, and TypeScript
- UI components from Radix UI and shadcn/ui
- Inspired by modern supply chain management practices
