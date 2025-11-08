FROM node:22-alpine

WORKDIR /app

# Install pnpm and tools required during dependency installation
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies using lockfile for reproducibility
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 3100

# Start development server
CMD ["pnpm", "run", "dev", "--host", "--port", "3100"]
