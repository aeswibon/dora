import DoraMetricsChart from "@c/DoraMetrics";

export default function Home() {
  return (
    <div>
      <h1>DORA Metrics</h1>
      <DoraMetricsChart
        owner="coronasafe"
        startDate="2024-06-14"
        endDate="2024-06-27"
        granularity="week"
      />
    </div>
  );
}
