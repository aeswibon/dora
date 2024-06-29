import axios from "axios";

const api = axios.create({
  // baseURL: "http://localhost:8080",
});

export const fetchDoraMetrics = async (owner: string, repo?: string) => {
  try {
    const response = await api.get(`/dora?owner=${owner}&repo=${repo}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching DORA metrics:", error);
    throw error;
  }
};
