import {
  aiService,
  type AIGenerateOptions,
  type AIStreamChunk,
} from "@/services/ai";

export const aiClient = {
  generate(options: AIGenerateOptions): AsyncIterable<AIStreamChunk> {
    return aiService.generate(options);
  },
};
