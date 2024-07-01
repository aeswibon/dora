import { PrismaClient } from "@prisma/client";
import logger from "../logger.js";

class DataDB {
  private client: PrismaClient;
  constructor() {
    this.client = new PrismaClient();
  }

  get db() {
    return this.client;
  }

  async connect() {
    await this.client.$connect();
    logger.info("Connected to MongoDB");
  }

  async close() {
    await this.client.$disconnect();
    logger.info("Closed connection to MongoDB");
  }
}

export default DataDB;
