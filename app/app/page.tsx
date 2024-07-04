"use client";

import DoraMetricsChart from "@c/DoraMetrics";
import InputBox from "@c/Input";
import SelectBox from "@c/Select";
import { useState } from "react";

export default function Home() {
  const [owner, setOwner] = useState("appsmithorg");
  const [repo, setRepo] = useState("appsmith");
  const [startDate, setStartDate] = useState("2024-05-14");
  const [endDate, setEndDate] = useState("2024-06-27");
  const [granularity, setGranularity] = useState("week");

  return (
    <div className="p-6 flex flex-col gap-y-6">
      <h1>DORA Metrics</h1>
      <div className="grid lg:grid-cols-5 gap-10">
        <InputBox label="Owner" state={owner} setState={setOwner} />
        <InputBox label="Repo" state={repo} setState={setRepo} />
        <InputBox
          type="date"
          label="Start Date"
          state={startDate}
          setState={setStartDate}
        />
        <InputBox
          type="date"
          label="End Date"
          state={endDate}
          setState={setEndDate}
        />
        <SelectBox
          label="Granularity"
          state={granularity}
          setState={setGranularity}
          options={[
            { key: "day", value: "day", label: "Day" },
            { key: "week", value: "week", label: "Week" },
            { key: "month", value: "month", label: "Month" },
          ]}
        />
      </div>
      <DoraMetricsChart
        owner={owner}
        repo={repo}
        startDate={startDate}
        endDate={endDate}
        granularity={granularity}
      />
    </div>
  );
}
