# -------------------
# Build stage (C++)
# -------------------
FROM alpine:3.19 AS build

# Cài g++ và toolchain để compile C++
RUN apk add --no-cache g++ make cmake pkgconf build-base

WORKDIR /src

# Copy source code vào container
COPY PDPTW_HYBRID_ACO_GREEDY_V3.cpp /src/

# Compile ra binary Linux với tên rõ ràng
RUN g++ PDPTW_HYBRID_ACO_GREEDY_V3.cpp -O2 -std=c++17 -o PDPTW_HYBRID_ACO_GREEDY_V3_LINUX

# -------------------
# Runtime stage (Node.js)
# -------------------
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package.json và cài deps
COPY package*.json ./
RUN npm ci --only=production

# Copy toàn bộ source Node.js
COPY . .

# Copy binary từ build stage
COPY --from=build /src/PDPTW_HYBRID_ACO_GREEDY_V3_LINUX ./PDPTW_HYBRID_ACO_GREEDY_V3_LINUX

# Đảm bảo binary có quyền thực thi
RUN chmod +x ./PDPTW_HYBRID_ACO_GREEDY_V3_LINUX

# Debug: liệt kê file để chắc chắn binary tồn tại
RUN ls -l /usr/src/app && file /usr/src/app/PDPTW_HYBRID_ACO_GREEDY_V3_LINUX

# Thiết lập cổng
ENV PORT=3001
EXPOSE 3001

# Tạo user không phải root để chạy app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /usr/src/app
USER appuser

# Start backend
CMD ["node", "server.js"]