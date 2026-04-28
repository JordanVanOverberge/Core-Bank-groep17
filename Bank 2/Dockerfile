# Dockerfile voor Bank 2 API
FROM node:20-alpine

WORKDIR /app

# Kopieer package files
COPY package*.json ./

# Installeer dependencies
RUN npm install

# Kopieer applicatie code
COPY . .

# Expose poort
EXPOSE 3001

# Start applicatie
CMD ["node", "index.js"]