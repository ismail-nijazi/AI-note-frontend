import { apiService } from "@/services/api";

export const testBackendConnection = async (): Promise<boolean> => {
  try {
    // Test AI health endpoint
    const aiHealth = await apiService.getAIHealth();

    // Test collections endpoint
    const collections = await apiService.getCollections();

    // Test notes endpoint
    const notes = await apiService.getNotes();

    return true;
  } catch (error) {
    return false;
  }
};
