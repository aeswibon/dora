"use client";

import { useQuery } from "@tanstack/react-query";
import ReactEcharts from "echarts-for-react";
import { fetchDoraMetrics } from "./utils";

type MetricEntry = {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  timeToRestoreService: number;
};

type OrgMetrics = {
  [date: string]: MetricEntry;
};

const DoraMetricsChart = ({
  owner,
  startDate,
  endDate,
  granularity,
  repo,
}: {
  owner: string;
  startDate: string;
  endDate: string;
  granularity: string;
  repo?: string;
}) => {
  const {
    data: doraData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["doraMetrics", owner, repo],
    queryFn: () =>
      fetchDoraMetrics(owner, startDate, endDate, granularity, repo),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error fetching data</div>;

  const calculateAverageMetrics = (orgMetrics: OrgMetrics): MetricEntry => {
    const metrics = Object.values(orgMetrics);
    const count = metrics.length;

    const sum = metrics.reduce((acc, curr) => ({
      deploymentFrequency: acc.deploymentFrequency + curr.deploymentFrequency,
      leadTimeForChanges: acc.leadTimeForChanges + curr.leadTimeForChanges,
      changeFailureRate: acc.changeFailureRate + curr.changeFailureRate,
      timeToRestoreService:
        acc.timeToRestoreService + curr.timeToRestoreService,
    }));

    return {
      deploymentFrequency: sum.deploymentFrequency / count,
      leadTimeForChanges: sum.leadTimeForChanges / count,
      changeFailureRate: sum.changeFailureRate / count,
      timeToRestoreService: sum.timeToRestoreService / count,
    };
  };

  const averageMetrics = calculateAverageMetrics(doraData.orgMetrics);

  const getOrgDeploymentFrequencyOption = () => ({
    tooltip: {
      trigger: "axis",
    },
    legend: {
      data: ["Organization Metrics"],
    },
    xAxis: {
      type: "category",
      data: Object.keys(doraData.orgMetrics),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Deployment Frequency",
        type: "line",
        data: Object.values(doraData.orgMetrics)
          .flatMap((org: any) => org)
          .map((o: any) => o.deploymentFrequency),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 20,
        top: 20,
        style: {
          text: `Avg: ${averageMetrics.deploymentFrequency.toFixed(2)}`,
          fontSize: 16,
          fontWeight: "bold",
        },
      },
    ],
  });

  const getOrgMeanTimeToResolveOption = () => ({
    tooltip: {
      trigger: "axis",
    },
    legend: {
      data: ["Organization Metrics"],
    },
    xAxis: {
      type: "category",
      data: Object.keys(doraData.orgMetrics),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Mean Time to Resolve",
        type: "line",
        data: Object.values(doraData.orgMetrics)
          .flatMap((org: any) => org)
          .map((o: any) => o.timeToRestoreService),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 20,
        top: 20,
        style: {
          text: `Avg: ${averageMetrics.timeToRestoreService.toFixed(2)}`,
          fontSize: 16,
          fontWeight: "bold",
        },
      },
    ],
  });

  const getOrgChangeFailureRateOption = () => ({
    tooltip: {
      trigger: "axis",
    },
    legend: {
      data: ["Organization Metrics"],
    },
    xAxis: {
      type: "category",
      data: Object.keys(doraData.orgMetrics),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Change Failure Rate",
        type: "line",
        data: Object.values(doraData.orgMetrics)
          .flatMap((org: any) => org)
          .map((o: any) => o.changeFailureRate),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 20,
        top: 20,
        style: {
          text: `Avg: ${averageMetrics.changeFailureRate.toFixed(2)}`,
          fontSize: 16,
          fontWeight: "bold",
        },
      },
    ],
  });

  const getOrgLeadTimeForChangesOption = () => ({
    tooltip: {
      trigger: "axis",
    },
    legend: {
      data: ["Organization Metrics"],
    },
    xAxis: {
      type: "category",
      data: Object.keys(doraData.orgMetrics),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Lead time for Changes",
        type: "line",
        data: Object.values(doraData.orgMetrics)
          .flatMap((org: any) => org)
          .map((o: any) => o.leadTimeForChanges),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 20,
        top: 20,
        style: {
          text: `Avg: ${averageMetrics.leadTimeForChanges.toFixed(2)}`,
          fontSize: 16,
          fontWeight: "bold",
        },
      },
    ],
  });

  return (
    <div>
      <h2>Organization Metrics</h2>
      <ReactEcharts option={getOrgChangeFailureRateOption()} />
      <ReactEcharts option={getOrgDeploymentFrequencyOption()} />
      <ReactEcharts option={getOrgLeadTimeForChangesOption()} />
      <ReactEcharts option={getOrgMeanTimeToResolveOption()} />
    </div>
  );
};

export default DoraMetricsChart;
