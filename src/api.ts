import { Message } from './types';

const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY;
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export async function fetchChatCompletionStream(
  messages: Message[],
  onMessage: (chunk: string) => void
): Promise<void> {
  if (!API_KEY) {
    throw new Error('API Key is not configured. Please check your .env file.');
  }

  // Format messages for the API
  const formattedMessages = messages.map(({ role, content }) => ({
    role,
    content,
  }));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-4',
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API Error: ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error('No response body stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line === '') continue;
          if (line === 'data: [DONE]') continue;

          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.replace('data: ', '');
              const data = JSON.parse(dataStr);
              
              if (data.choices && data.choices[0]?.delta?.content) {
                onMessage(data.choices[0].delta.content);
              }
            } catch (e) {
              console.warn('Failed to parse stream chunk:', line, e);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching chat completion:', error);
    throw error;
  }
}
