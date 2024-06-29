import DoraMetricsChart from "@c/DoraMetrics";

export default function Home() {
  return (
    <div>
      <h1>DORA Metrics</h1>
      <DoraMetricsChart owner="coronasafe" />
    </div>
  );
}
