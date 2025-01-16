# Use the official Node.js 22 image as the base image
FROM node:22-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY ./src/ ./src/

# Build the TypeScript code
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000
ENV NODE_ENV=production

# Command to run the app
CMD ["npm", "start"]