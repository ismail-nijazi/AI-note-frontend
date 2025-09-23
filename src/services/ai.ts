import { ChatMessage } from '@/state/useAIStore';
import { Note } from '@/state/useWorkspaceStore';

export interface AIContext {
  note?: Note;
  selectedBoxContent?: string;
}

export interface AIGenerateOptions {
  messages: ChatMessage[];
  context?: AIContext;
  includeContext?: boolean;
}

// Mock AI service for demo - can be replaced with OpenAI, Anthropic, etc.
export class AIService {
  async *generate(options: AIGenerateOptions): AsyncIterable<string> {
    const { messages, context, includeContext = true } = options;
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const lastMessage = messages[messages.length - 1];
    const userInput = lastMessage?.content || '';
    
    // Build context string if enabled
    let contextString = '';
    if (includeContext && context?.note) {
      const { note } = context;
      contextString = `\n\nContext - Note: "${note.title}"\n`;
      contextString += `Boxes content: ${note.boxes.map(box => 
        box.content.map(node => (node as any).children?.map((child: any) => child.text).join(' ')).join(' ')
      ).join(' | ')}\n`;
      
      if (context.selectedBoxContent) {
        contextString += `Selected text: "${context.selectedBoxContent}"\n`;
      }
    }
    
    // Generate mock response based on input
    let response = this.generateMockResponse(userInput, contextString);
    
    // Stream the response character by character
    for (let i = 0; i < response.length; i++) {
      yield response.slice(0, i + 1);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  
  private generateMockResponse(input: string, context: string): string {
    const lowerInput = input.toLowerCase();
    
    // Quick action responses
    if (lowerInput.startsWith('/summarize')) {
      return 'Here\'s a summary of your note:\n\n• Key points from your whiteboard boxes\n• Main themes and concepts\n• Action items or next steps\n\nThis is a mock summary. In production, this would analyze your actual note content.';
    }
    
    if (lowerInput.startsWith('/outline')) {
      return '# Note Outline\n\n## 1. Introduction\n- Overview of main topics\n\n## 2. Key Points\n- Important concepts\n- Supporting details\n\n## 3. Conclusion\n- Summary\n- Next steps\n\nThis is a mock outline. In production, this would create an outline from your note content.';
    }
    
    if (lowerInput.startsWith('/rewrite')) {
      return 'Here\'s a rewritten version of your content:\n\n*[Rewritten text would appear here based on your selected content]*\n\nThis is a mock rewrite. In production, this would rewrite your selected text.';
    }
    
    if (lowerInput.startsWith('/todo')) {
      return '## Action Items\n\n- [ ] Review main concepts\n- [ ] Organize notes\n- [ ] Follow up on key points\n- [ ] Schedule next review\n\nThis is a mock todo list. In production, this would extract actionable items from your notes.';
    }
    
    if (lowerInput.startsWith('/translate')) {
      return 'Translation:\n\n*[Translated content would appear here]*\n\nThis is a mock translation. In production, this would translate your selected text.';
    }
    
    if (lowerInput.startsWith('/insert')) {
      return 'I can help you insert content into your note boxes. This would:\n\n• Insert text at your current cursor position\n• Create new boxes with generated content\n• Replace selected text with improved versions\n\nThis is a mock response. In production, I would generate specific content to insert.';
    }
    
    // General responses
    if (lowerInput.includes('help')) {
      return 'I can help you with your whiteboard notes in several ways:\n\n• **Summarize** your notes\n• **Create outlines** from your content\n• **Rewrite** text to improve clarity\n• **Insert** new content into boxes\n• **Generate** todo lists from your notes\n• **Translate** text to other languages\n\nYou can use quick actions by typing commands like /summarize, /outline, /rewrite, etc.';
    }
    
    if (lowerInput.includes('create') || lowerInput.includes('add')) {
      return 'I can help you create new content for your whiteboard:\n\n• New note boxes with specific topics\n• Structured outlines and frameworks\n• Bullet points and lists\n• Mind maps and concept connections\n\nWhat would you like me to create for you?';
    }
    
    // Default response
    return `I understand you're asking about: "${input}"\n\n${context ? 'Based on your note context, ' : ''}I can help you with various tasks like summarizing, outlining, rewriting content, or creating new material for your whiteboard.\n\nThis is a mock AI response. In production, this would be powered by a real language model like GPT-4, Claude, or similar.`;
  }
}

// Singleton instance
export const aiService = new AIService();