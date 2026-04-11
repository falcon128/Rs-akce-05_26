FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public
COPY data ./data
COPY uploads ./uploads

EXPOSE 3000

CMD ["npm", "start"]
