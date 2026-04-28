FROM node:24-alpine AS base
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install
COPY . .
RUN npm --workspace apps/api run build

FROM node:24-alpine
WORKDIR /app
COPY --from=base /app /app
CMD ["npm", "--workspace", "apps/api", "run", "start"]

