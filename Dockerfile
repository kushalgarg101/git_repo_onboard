# Build stage for React/Vite frontend
FROM node:20-slim AS build-stage
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Runtime stage for Python/FastAPI backend
FROM python:3.12-slim AS runtime-stage
WORKDIR /app

# Install git (required for repository analysis)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install dependencies using UV for speed (optional)
# Or just use pip as it's more standard for base images
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy backend source code
COPY src/ ./src/

# Copy built frontend assets from builder
COPY --from=build-stage /app/frontend/dist ./frontend/dist

# Expose the application port
EXPOSE 8000

# Start the server using uvicorn factory
# Render provides the $PORT environment variable.
CMD uvicorn github_viz.server:create_app --factory --host 0.0.0.0 --port ${PORT:-10000}
