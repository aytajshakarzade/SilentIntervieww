# ==========================================
# Stage 1 - Build React Application
# ==========================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Default is port 5000 (Docker backend). Override at build time if needed.
ARG VITE_API_BASE_URL=http://localhost:5000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# VITE_GOOGLE_CLIENT_ID is intentionally not overwritten here. Vite reads the
# value from the copied frontend/.env file, while the backend validates the same
# public client id from its own environment at runtime.
RUN npm run build


# ==========================================
# Stage 2 - Nginx
# ==========================================
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
