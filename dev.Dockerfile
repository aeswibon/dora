FROM node:lts-alpine

# Install pnpm
RUN npm install -g pnpm

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json pnpm-lock.yaml prisma ./

# Install dependencies
RUN pnpm install && pnpm prisma generate

# Copy TypeScript configuration
COPY tsconfig.json ./

# Copy the rest of your application's source code
COPY . ./

# Compile TypeScript to JavaScript
RUN pnpm run compile

# Your app binds to port 3000 so you'll use the EXPOSE instruction to have it mapped by the docker daemon
EXPOSE 8080

# Define the command to run your app using CMD which defines your runtime
CMD [ "node", "dist/index.js" ]