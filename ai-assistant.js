const OpenAI = require('openai');
const db = require('./database');
const NewsAgent = require('./news-agent');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Initialize news agent
const newsAgent = new NewsAgent(db);

// System prompt for pAI assistant
const SYSTEM_PROMPT = `You are pAI, a helpful and friendly personal AI assistant in the Talk pAI messenger app.
You help users with various tasks including:
- Summarizing conversations
- Answering questions
- Providing creative ideas
- Language translation
- Task management
- General assistance
- News briefings (working with Sage, your news agent colleague)

Keep responses concise but helpful. Use a friendly, conversational tone.
When summarizing conversations, focus on key points, decisions, and action items.
If asked about voice messages, remind users you can transcribe and respond to them.

🔮 FUTURE FEATURES PREVIEW:
In the next version, users will be able to create their own custom AI agents for specialized tasks like:
- Financial advisor agents
- Health & wellness coaches
- Productivity assistants
- Learning companions
- Travel planners
These agents will have custom personalities, knowledge bases, and interaction patterns tailored to each user's needs.`;

// Cache for conversation context
const conversationCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Process message from user
async function processMessage(sender, content, type) {
  try {
    if (!openai) {
      return "I'm currently offline. Please ask the admin to configure the OpenAI API key.";
    }

    // Check if this is a news request - if so, route to Sage news agent
    if (isNewsRelated(content)) {
      const newsResponse = await newsAgent.processNewsInteraction(sender, content);
      if (newsResponse) {
        return newsResponse;
      }
    }

    // Get conversation history for context
    const context = getConversationContext(sender);

    // Handle different message types
    if (type === 'audio') {
      return "I received your voice message! Please use the transcribe button to convert it to text, and I'll respond.";
    }

    // Check for special commands
    if (content.toLowerCase().startsWith('/summarize')) {
      return await handleSummarizeCommand(sender, content);
    }

    if (content.toLowerCase().startsWith('/help')) {
      return getHelpMessage();
    }

    if (content.toLowerCase().startsWith('/translate')) {
      return await handleTranslateCommand(content);
    }

    if (content.toLowerCase().startsWith('/news')) {
      return await handleNewsCommand(sender, content);
    }

    // Regular conversation
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...context,
      { role: 'user', content }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const response = completion.choices[0].message.content;

    // Update context cache
    updateConversationContext(sender, content, response);

    return response;

  } catch (error) {
    console.error('AI Assistant error:', error);

    if (error.code === 'insufficient_quota') {
      return "I'm temporarily unavailable due to API limits. Please try again later.";
    }

    return "I encountered an error processing your message. Please try again or contact support if the issue persists.";
  }
}

// Summarize conversation
async function summarizeConversation(messages) {
  try {
    if (!openai) {
      return "Summarization unavailable - OpenAI API not configured.";
    }

    if (messages.length === 0) {
      return "No messages to summarize.";
    }

    // Format messages for summarization
    const conversationText = messages.map(m => 
      `${m.sender}: ${m.content}`
    ).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Summarize the following conversation in a concise, bullet-pointed format. 
          Focus on:
          - Key topics discussed
          - Important decisions made
          - Action items or next steps
          - Any questions that need answers
          Keep it brief but comprehensive.`
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
      max_tokens: 500,
      temperature: 0.5
    });

    const summary = completion.choices[0].message.content;
    
    // Save summary to database
    const startDate = messages[0].time;
    const endDate = messages[messages.length - 1].time;
    db.saveSummary(messages[0].sender, 'conversation', summary, messages.length, startDate, endDate);
    
    return summary;

  } catch (error) {
    console.error('Summarization error:', error);
    return "Failed to generate summary. Please try again later.";
  }
}

// Handle summarize command
async function handleSummarizeCommand(sender, content) {
  try {
    const parts = content.split(' ');
    const hours = parseInt(parts[1]) || 24;
    const conversation = parts[2] || 'all';
    
    const messages = db.getConversationHistory(sender, conversation, hours);
    
    if (messages.length === 0) {
      return `No messages found in the last ${hours} hours.`;
    }
    
    const summary = await summarizeConversation(messages);
    
    return `📊 **Summary of last ${hours} hours:**\n\n${summary}\n\n_Total messages: ${messages.length}_`;
    
  } catch (error) {
    console.error('Summarize command error:', error);
    return "Failed to summarize. Usage: /summarize [hours] [conversation]";
  }
}

// Handle translate command
async function handleTranslateCommand(content) {
  try {
    const textToTranslate = content.replace('/translate', '').trim();
    
    if (!textToTranslate) {
      return "Usage: /translate [text]\nExample: /translate Hello, how are you?";
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Translate the following text to English if it\'s in another language, or to Spanish if it\'s in English. Provide only the translation.'
        },
        {
          role: 'user',
          content: textToTranslate
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    });
    
    return `🌐 Translation: ${completion.choices[0].message.content}`;
    
  } catch (error) {
    console.error('Translation error:', error);
    return "Translation failed. Please try again.";
  }
}

// Check if message is news-related
function isNewsRelated(content) {
  const newsKeywords = [
    'news', 'headlines', 'latest', 'update', 'breaking', 'subscribe',
    'technology news', 'business news', 'world news', 'sports news',
    'entertainment', 'science news', 'health news', 'рсс', 'новини'
  ];

  return newsKeywords.some(keyword =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );
}

// Handle news commands
async function handleNewsCommand(sender, content) {
  try {
    const parts = content.toLowerCase().split(' ');

    if (parts.includes('subscribe') || parts.includes('setup')) {
      return newsAgent.generateOnboardingMessage();
    }

    if (parts.includes('sources')) {
      const sources = newsAgent.getAvailableSources();
      let message = "📰 **Available News Sources:**\n\n";

      Object.entries(sources).forEach(([category, sourceList]) => {
        message += `**${category.charAt(0).toUpperCase() + category.slice(1)}:**\n`;
        sourceList.forEach(source => {
          message += `• ${source.name}\n`;
        });
        message += '\n';
      });

      return message;
    }

    // Default news help
    return `📰 **News Commands:**
• /news subscribe - Set up your news preferences
• /news sources - See available news sources
• /news latest - Get latest news summary

🤖 **Or just ask naturally:**
• "Give me the latest tech news"
• "Subscribe me to daily business updates"
• "What's happening in the world?"

📡 **Meet Sage:** Your dedicated news assistant who can provide personalized news briefings from hundreds of sources!`;

  } catch (error) {
    console.error('News command error:', error);
    return "I had trouble with that news command. Try asking Sage directly about news!";
  }
}

// Get help message
function getHelpMessage() {
  return `🤖 **pAI Assistant Commands:**

📝 **General Chat** - Just send me a message!

🎯 **Commands:**
• /help - Show this help message
• /summarize [hours] [chat] - Summarize recent conversations
• /translate [text] - Translate text
• /news - News and Sage agent commands

💡 **Tips:**
• Send voice messages - I'll help transcribe them
• Ask me anything - I'm here to help!
• I can help with creative ideas, problem-solving, and more
• Talk to Sage for personalized news briefings

🔮 **Coming Soon:** Custom AI agents for finance, health, productivity, and more! Create your own specialized assistants.

🔒 **Privacy:** Your conversations with me are private and secure.`;
}

// Manage conversation context
function getConversationContext(sender) {
  const cached = conversationCache.get(sender);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.messages;
  }
  
  return [];
}

function updateConversationContext(sender, userMessage, aiResponse) {
  const context = getConversationContext(sender);
  
  // Keep only last 10 messages for context
  const newContext = [
    ...context,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: aiResponse }
  ].slice(-10);
  
  conversationCache.set(sender, {
    messages: newContext,
    timestamp: Date.now()
  });
}

// Clean up old cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of conversationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      conversationCache.delete(key);
    }
  }
}, 10 * 60 * 1000); // Clean every 10 minutes

// Generate creative responses
async function generateCreativeResponse(prompt, style = 'normal') {
  try {
    const styles = {
      'normal': 'Respond naturally and helpfully',
      'creative': 'Be creative and imaginative',
      'professional': 'Use a professional business tone',
      'casual': 'Be very casual and friendly',
      'technical': 'Provide technical details and explanations'
    };
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nStyle: ${styles[style] || styles.normal}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: style === 'creative' ? 0.9 : 0.7
    });
    
    return completion.choices[0].message.content;
    
  } catch (error) {
    console.error('Creative response error:', error);
    return null;
  }
}

// Analyze sentiment
async function analyzeSentiment(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Analyze the sentiment of the text. Respond with only: positive, negative, or neutral.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 10,
      temperature: 0
    });
    
    return completion.choices[0].message.content.toLowerCase().trim();
    
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return 'neutral';
  }
}

// Generate suggested replies
async function generateSuggestedReplies(context) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Generate 3 short, natural suggested replies for this conversation. Return them as a JSON array of strings.'
        },
        {
          role: 'user',
          content: context
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });
    
    const response = completion.choices[0].message.content;
    return JSON.parse(response);
    
  } catch (error) {
    console.error('Suggested replies error:', error);
    return ["Yes", "No", "Tell me more"];
  }
}

module.exports = {
  processMessage,
  summarizeConversation,
  generateCreativeResponse,
  analyzeSentiment,
  generateSuggestedReplies
};