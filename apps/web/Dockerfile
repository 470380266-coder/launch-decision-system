FROM node:24-alpine AS base
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install
COPY . .
RUN npm --workspace apps/web run build

FROM node:24-alpine
WORKDIR /app
COPY --from=base /app /app
CMD ["npm", "--workspace", "apps/web", "run", "start"]

