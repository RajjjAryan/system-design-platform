FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV SDS_DB_PATH=/app/.data/systemdesign.sqlite

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server ./server

RUN mkdir -p /app/.data

EXPOSE 8787

CMD ["npm", "start"]
