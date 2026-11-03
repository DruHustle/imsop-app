# IMSOP app

- `imsop-app-frontend/` contains the frontend application.
- `imsop-app-backend/` contains the backend application and deployment tooling.
- `local-tools/` contains local tools and release evidence.

The combined commit retains both original Git histories. Follow each application's README for setup and checks. The original repositories remain the active sources for production deployments and CI. The root GitHub Actions workflow checks both applications without deploying them. Workflows inside application folders are not automatically discovered by GitHub Actions; production deployment and full paired-system qualification must be migrated and verified before treating this repository as the deployment source.
