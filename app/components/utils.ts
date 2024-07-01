import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

export const fetchDoraMetrics = async (
  owner: string,
  startDate: string,
  endDate: string,
  granularity: string,
  repo?: string
) => {
  try {
    const response = await api.get(
      `/dora?owner=${owner}&startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&repo=${repo}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching DORA metrics:", error);
    throw error;
  }
};
