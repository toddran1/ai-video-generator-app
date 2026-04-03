FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src

EXPOSE 5173
