FROM node:20-alpine AS base

# Install Python 3 and build tools needed for Prophet (C++ extension)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    g++ \
    make \
    musl-dev \
    libffi-dev \
    openblas-dev \
    lapack-dev

WORKDIR /app

# Copy package manifests first for caching
COPY package.json package-lock.json ./
COPY requirements.txt ./

# Install Node dependencies (production)
RUN npm ci --production

# Install Python dependencies
RUN pip3 install --break-system-packages --upgrade pip && \
    pip3 install --break-system-packages -r requirements.txt

# Copy the rest of the source code
COPY . .

EXPOSE 5000

# Start the Node server (same as local dev command)
CMD ["npm", "run", "dev"]
