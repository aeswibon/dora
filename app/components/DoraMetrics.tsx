"use client";

import { gql, useQuery } from "@apollo/client";
import ReactEcharts from "echarts-for-react";

interface IMetricEntry {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  timeToRestoreService: number;
}

interface IOrgMetric extends IMetricEntry {
  org: string;
}

type OrgEntry = {
  key: string;
  value: IOrgMetric[];
};

interface DoraData {
  orgs: OrgEntry[];
}

const GET_DORA_METRICS = gql`
  query DoraQuery(
    $owner: String!
    $startDate: String!
    $endDate: String!
    $granularity: String!
    $repo: String
  ) {
    dora(
      owner: $owner
      startDate: $startDate
      endDate: $endDate
      granularity: $granularity
      repo: $repo
    ) {
      data {
        orgs {
          key
          value {
            org
            deploymentFrequency
            leadTimeForChanges
            changeFailureRate
            timeToRestoreService
          }
        }
      }
      code
      message
    }
  }
`;

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
    data,
    loading: isLoading,
    error,
  } = useQuery(GET_DORA_METRICS, {
    variables: {
      owner,
      startDate,
      endDate,
      granularity,
      repo,
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error fetching data</div>;

  const doraData = data.dora.data;

  const calculateAverageMetrics = (orgEntries: any[]): any => {
    const metrics = orgEntries.flatMap((entry) => entry.value);
    const count = metrics.length;
    const sum = metrics.reduce((acc, curr) => ({
      org: owner,
      deploymentFrequency:
        acc.deploymentFrequency + (parseFloat(curr.deploymentFrequency) ?? 0),
      leadTimeForChanges:
        acc.leadTimeForChanges + (parseFloat(curr.leadTimeForChanges) ?? 0),
      changeFailureRate:
        acc.changeFailureRate + (parseFloat(curr.changeFailureRate) ?? 0),
      timeToRestoreService:
        acc.timeToRestoreService + (parseFloat(curr.timeToRestoreService) ?? 0),
    }));
    return {
      org: owner,
      deploymentFrequency: sum.deploymentFrequency / count,
      leadTimeForChanges: sum.leadTimeForChanges / count,
      changeFailureRate: sum.changeFailureRate ?? 0 / count,
      timeToRestoreService: sum.timeToRestoreService / count,
    };
  };

  const averageMetrics = calculateAverageMetrics(doraData.orgs);

  const getOrgDeploymentFrequencyOption = () => ({
    tooltip: {
      trigger: "axis",
    },
    legend: {
      data: ["Organization Metrics"],
    },
    xAxis: {
      type: "category",
      data: doraData.orgs.map((entry: OrgEntry) => entry.key),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Deployment Frequency",
        type: "line",
        data: doraData.orgs.flatMap((entry: OrgEntry) =>
          entry.value.map((v: IOrgMetric) => v.deploymentFrequency)
        ),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 20,
        top: 20,
        style: {
          text: `Avg: ${parseFloat(averageMetrics.deploymentFrequency).toFixed(
            2
          )}`,
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
      data: doraData.orgs.map((entry: OrgEntry) => entry.key),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Mean Time to Resolve",
        type: "line",
        data: doraData.orgs.flatMap((entry: OrgEntry) =>
          entry.value.map((v: IOrgMetric) => v.timeToRestoreService)
        ),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 20,
        top: 20,
        style: {
          text: `Avg: ${parseFloat(averageMetrics.timeToRestoreService).toFixed(
            2
          )}`,
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
      data: doraData.orgs.map((entry: OrgEntry) => entry.key),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Change Failure Rate",
        type: "line",
        data: doraData.orgs.flatMap((entry: OrgEntry) =>
          entry.value.map((v: IOrgMetric) => v.changeFailureRate)
        ),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 20,
        top: 20,
        style: {
          text: `Avg: ${parseFloat(averageMetrics.changeFailureRate).toFixed(
            2
          )}`,
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
      data: doraData.orgs.map((entry: OrgEntry) => entry.key),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: "Lead time for Changes",
        type: "line",
        data: doraData.orgs.flatMap((entry: OrgEntry) =>
          entry.value.map((v: IOrgMetric) => v.leadTimeForChanges)
        ),
      },
    ],
    graphic: [
      {
        type: "text",
        right: 20,
        top: 20,
        style: {
          text: `Avg: ${parseFloat(averageMetrics.leadTimeForChanges).toFixed(
            2
          )}`,
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
