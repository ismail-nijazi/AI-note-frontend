import { apiService } from '@/services/api';

export const testBackendConnection = async (): Promise<boolean> => {
  try {
    console.log('Testing backend connection...');
    
    // Test AI health endpoint
    const aiHealth = await apiService.getAIHealth();
    console.log('AI Health:', aiHealth);
    
    // Test collections endpoint
    const collections = await apiService.getCollections();
    console.log('Collections:', collections);
    
    // Test notes endpoint
    const notes = await apiService.getNotes();
    console.log('Notes:', notes);
    
    console.log('✅ Backend connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Backend connection failed:', error);
    return false;
  }
};
