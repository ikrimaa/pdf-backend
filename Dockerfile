# Simple Dockerfile for the PDF backend
# - Installs Ghostscript
# - Installs Node deps
# - Exposes PORT (default 4000)

FROM node:18-slim

ENV PORT=4000
ENV GS_BIN=/usr/bin/gs
ENV NODE_ENV=production

WORKDIR /app

# Install Ghostscript
RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript \
  && rm -rf /var/lib/apt/lists/*

# Copy deps and install
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

EXPOSE ${PORT}

CMD ["npm", "start"]
