import { InfluxDB, Point } from "@influxdata/influxdb-client";

class StatsDB {
  private client: InfluxDB;

  constructor() {
    const token = process.env.INFLUXDB_TOKEN;
    const url = process.env.INFLUX_URL;
    if (!token) {
      throw new Error("Missing required environment variable: INFLUXDB_TOKEN");
    }
    if (!url) {
      throw new Error("Missing required environment variable: INFLUX_URL");
    }
    this.client = new InfluxDB({ url, token });
  }

  async writePoints(points: Point[]) {
    const writeApi = this.client.getWriteApi("", "dora");
    writeApi.writePoints(points);
    writeApi.close();
  }
}

export default StatsDB;
