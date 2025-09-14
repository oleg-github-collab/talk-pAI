const OpenAI = require('openai');
const db = require('./database-pg');
const NewsAgent = require('./news-agent');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Initialize news agent
const newsAgent = new NewsAgent(db);

// Enhanced system prompt for pAI assistant with advanced capabilities
const SYSTEM_PROMPT = `You are pAI, an advanced and highly intelligent personal AI assistant in the Talk pAI messenger app.

🧠 CORE CAPABILITIES:
- Advanced conversation analysis and summarization
- Multi-step reasoning and problem solving
- Creative thinking and ideation
- Language translation (100+ languages)
- Code analysis, debugging, and generation
- Math, science, and technical explanations
- Task planning and project management
- Research assistance and fact-checking
- Writing assistance and editing
- Strategic planning and decision support

🤖 ENHANCED AI FEATURES:
- Context-aware memory across conversations
- Multi-modal understanding (text, audio, images when available)
- Chain-of-thought reasoning for complex problems
- Adaptive communication style based on user preferences
- Real-time learning from user interactions
- Collaborative working with Sage news agent

💡 INTERACTION STYLE:
- Be intelligent but approachable
- Provide detailed explanations when requested
- Break down complex topics into digestible parts
- Ask clarifying questions when context is unclear
- Offer multiple perspectives on problems
- Suggest follow-up actions and next steps
- Use examples and analogies to clarify concepts

🎯 SPECIALIZED MODES:
- /expert: Provide technical, detailed responses
- /creative: Focus on brainstorming and innovation
- /tutor: Educational, step-by-step explanations
- /analyst: Data analysis and insights
- /coach: Motivational and goal-oriented guidance

🔮 COMING SOON - Custom AI Agents:
Users will create specialized agents for finance, health, productivity, learning, and more!

Remember: You're not just an assistant - you're a thinking partner helping users achieve their goals.`;

// Cache for conversation context
const conversationCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Enhanced error handling and reliability
function validateInput(sender, content, type) {
  if (!sender || typeof sender !== 'string') {
    throw new Error('Invalid sender');
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Invalid or empty content');
  }
  if (content.length > 4000) {
    throw new Error('Content too long (max 4000 characters)');
  }
  return true;
}

// Retry mechanism for OpenAI API calls
async function callOpenAIWithRetry(params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create(params);
      if (!completion.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI');
      }
      return completion;
    } catch (error) {
      console.error(`OpenAI attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

// Process message from user
async function processMessage(sender, content, type) {
  try {
    // Validate inputs
    validateInput(sender, content, type);

    if (!openai) {
      return "🤖 I'm currently offline. Please ask the admin to configure the OpenAI API key.";
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

    // Check for special commands and modes
    if (content.toLowerCase().startsWith('/summarize')) {
      return await handleSummarizeCommand(sender, content);
    }

    if (content.toLowerCase().startsWith('/help')) {
      return getEnhancedHelpMessage();
    }

    if (content.toLowerCase().startsWith('/translate')) {
      return await handleTranslateCommand(content);
    }

    if (content.toLowerCase().startsWith('/news')) {
      return await handleNewsCommand(sender, content);
    }

    if (content.toLowerCase().startsWith('/expert')) {
      return await handleExpertMode(sender, content);
    }

    if (content.toLowerCase().startsWith('/creative')) {
      return await handleCreativeMode(sender, content);
    }

    if (content.toLowerCase().startsWith('/tutor')) {
      return await handleTutorMode(sender, content);
    }

    if (content.toLowerCase().startsWith('/analyst')) {
      return await handleAnalystMode(sender, content);
    }

    if (content.toLowerCase().startsWith('/coach')) {
      return await handleCoachMode(sender, content);
    }

    if (content.toLowerCase().startsWith('/brainstorm')) {
      return await handleBrainstormCommand(sender, content);
    }

    if (content.toLowerCase().startsWith('/plan')) {
      return await handlePlanCommand(sender, content);
    }

    if (content.toLowerCase().startsWith('/research')) {
      return await handleResearchCommand(sender, content);
    }

    // Regular conversation
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...context,
      { role: 'user', content }
    ];

    const completion = await callOpenAIWithRetry({
      model: 'gpt-4o',
      messages,
      max_tokens: 800,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    });

    const response = completion.choices[0].message.content;

    // Update context cache
    updateConversationContext(sender, content, response);

    return response;

  } catch (error) {
    console.error('AI Assistant error:', error);

    // Enhanced error handling with specific messages
    if (error.code === 'insufficient_quota') {
      return "💳 I'm temporarily unavailable due to API limits. Please try again later.";
    }

    if (error.code === 'rate_limit_exceeded') {
      return "⏱️ I'm receiving too many requests. Please wait a moment and try again.";
    }

    if (error.code === 'invalid_api_key') {
      return "🔑 API key configuration issue. Please contact the administrator.";
    }

    if (error.message === 'Invalid sender' || error.message === 'Invalid or empty content' || error.message === 'Content too long (max 4000 characters)') {
      return `⚠️ ${error.message}. Please check your input and try again.`;
    }

    if (error.code === 'context_length_exceeded') {
      // Clear context and try again with shorter conversation
      conversationCache.delete(sender);
      return "📝 Conversation too long. I've cleared the context - please send your message again.";
    }

    return "🤖 I encountered an error processing your message. Please try again or contact support if the issue persists.";
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

    const completion = await callOpenAIWithRetry({
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
    
    const completion = await callOpenAIWithRetry({
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

// Get enhanced help message
function getEnhancedHelpMessage() {
  return `🤖 **pAI Assistant - Advanced AI Commands:**

💬 **General Chat** - Just send me a message!

🎯 **Core Commands:**
• /help - Show this help message
• /summarize [hours] [chat] - Summarize conversations
• /translate [text] - Translate text
• /news - News and Sage agent commands

🧠 **AI Specialized Modes:**
• /expert [question] - Technical, detailed responses
• /creative [topic] - Creative brainstorming and innovation
• /tutor [subject] - Educational, step-by-step explanations
• /analyst [data/topic] - Data analysis and insights
• /coach [goal] - Motivational and goal-oriented guidance
• /brainstorm [topic] - Advanced idea generation
• /plan [project] - Strategic planning assistance
• /research [topic] - Research and fact-checking

✨ **Advanced Features:**
• Context-aware memory across conversations
• Multi-step reasoning for complex problems
• Adaptive communication style
• Chain-of-thought reasoning
• Real-time learning from interactions

🔮 **Coming Soon:** Custom AI agents for finance, health, productivity!

🔒 **Privacy:** Your conversations are private and secure.`;
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
    
    const completion = await callOpenAIWithRetry({
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
    const completion = await callOpenAIWithRetry({
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
    const completion = await callOpenAIWithRetry({
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

// Specialized AI Mode Handlers
async function handleExpertMode(sender, content) {
  try {
    validateInput(sender, content, 'text');

    const query = content.replace('/expert', '').trim();
    if (!query) {
      return "🎓 **Expert Mode Activated**\n\nProvide your technical question for detailed, expert-level analysis.\n\nExample: `/expert How does blockchain consensus work?`";
    }

    const messages = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\nYou are now in EXPERT MODE. Provide highly technical, detailed, and comprehensive responses. Include technical terminology, specific examples, and in-depth explanations. Be precise and authoritative.`
      },
      { role: 'user', content: query }
    ];

    const completion = await callOpenAIWithRetry({
      model: 'gpt-4o',
      messages,
      max_tokens: 1200,
      temperature: 0.3,
      top_p: 0.9
    });

    return `🎓 **Expert Analysis:**\n\n${completion.choices[0].message.content}`;
  } catch (error) {
    console.error('Expert Mode error:', error);
    return "🎓 Expert mode is temporarily unavailable. Please try again or use regular chat.";
  }
}

async function handleCreativeMode(sender, content) {
  try {
    validateInput(sender, content, 'text');
    const query = content.replace('/creative', '').trim();
  if (!query) {
    return "🎨 **Creative Mode Activated**\n\nShare a topic for creative brainstorming and innovative ideas!\n\nExample: `/creative Ways to make remote work more engaging`";
  }

  const messages = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nYou are now in CREATIVE MODE. Think outside the box, generate innovative ideas, use creative analogies, and approach problems from unique angles. Be imaginative, inspiring, and suggest unconventional solutions.`
    },
    { role: 'user', content: query }
  ];

  const completion = await callOpenAIWithRetry({
    model: 'gpt-4o',
    messages,
    max_tokens: 1000,
    temperature: 0.9,
    top_p: 1.0,
    frequency_penalty: 0.3
  });

  return `🎨 **Creative Ideas:**\n\n${completion.choices[0].message.content}`;
  } catch (error) {
    console.error('Creative Mode error:', error);
    return "🎨 Creative mode is temporarily unavailable. Please try again or use regular chat.";
  }
}

async function handleTutorMode(sender, content) {
  try {
    validateInput(sender, content, 'text');
    const query = content.replace('/tutor', '').trim();
    if (!query) {
    return "👨‍🏫 **Tutor Mode Activated**\n\nWhat would you like to learn? I'll break it down step-by-step!\n\nExample: `/tutor Machine learning basics`";
  }

  const messages = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nYou are now in TUTOR MODE. Break down complex topics into easy-to-understand steps. Use clear explanations, examples, analogies, and check for understanding. Be patient, encouraging, and educational.`
    },
    { role: 'user', content: query }
  ];

  const completion = await callOpenAIWithRetry({
    model: 'gpt-4o',
    messages,
    max_tokens: 1000,
    temperature: 0.5,
    top_p: 0.9
  });

  return `👨‍🏫 **Learning Guide:**\n\n${completion.choices[0].message.content}`;
  } catch (error) {
    console.error('Tutor Mode error:', error);
    return "👨‍🏫 Tutor mode is temporarily unavailable. Please try again or use regular chat.";
  }
}

async function handleAnalystMode(sender, content) {
  try {
    validateInput(sender, content, 'text');
    const query = content.replace('/analyst', '').trim();
    if (!query) {
    return "📊 **Analyst Mode Activated**\n\nProvide data, trends, or topics for detailed analysis and insights!\n\nExample: `/analyst Current AI market trends`";
  }

  const messages = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nYou are now in ANALYST MODE. Provide data-driven insights, identify patterns, analyze trends, and offer evidence-based conclusions. Use structured thinking and present findings clearly with key takeaways.`
    },
    { role: 'user', content: query }
  ];

  const completion = await callOpenAIWithRetry({
    model: 'gpt-4o',
    messages,
    max_tokens: 1000,
    temperature: 0.4,
    top_p: 0.9
  });

  return `📊 **Analysis Report:**\n\n${completion.choices[0].message.content}`;
  } catch (error) {
    console.error('Analyst Mode error:', error);
    return "📊 Analyst mode is temporarily unavailable. Please try again or use regular chat.";
  }
}

async function handleCoachMode(sender, content) {
  try {
    validateInput(sender, content, 'text');
    const query = content.replace('/coach', '').trim();
    if (!query) {
    return "🏆 **Coach Mode Activated**\n\nShare your goals or challenges for motivational guidance and action plans!\n\nExample: `/coach I want to improve my productivity`";
  }

  const messages = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nYou are now in COACH MODE. Be motivational, supportive, and action-oriented. Help set clear goals, create actionable plans, and provide encouragement. Focus on practical steps and positive mindset.`
    },
    { role: 'user', content: query }
  ];

  const completion = await callOpenAIWithRetry({
    model: 'gpt-4o',
    messages,
    max_tokens: 1000,
    temperature: 0.7,
    top_p: 0.9
  });

  return `🏆 **Coaching Session:**\n\n${completion.choices[0].message.content}`;
  } catch (error) {
    console.error('Coach Mode error:', error);
    return "🏆 Coach mode is temporarily unavailable. Please try again or use regular chat.";
  }
}

async function handleBrainstormCommand(sender, content) {
  try {
    validateInput(sender, content, 'text');
    const query = content.replace('/brainstorm', '').trim();
    if (!query) {
    return "💡 **Brainstorm Mode**\n\nLet's generate ideas! What topic should we brainstorm?\n\nExample: `/brainstorm App features for fitness tracking`";
  }

  const messages = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nYou are in BRAINSTORM MODE. Generate diverse, creative ideas rapidly. Think broadly, combine concepts, and suggest both practical and wild ideas. Present ideas in a structured, easy-to-scan format.`
    },
    { role: 'user', content: query }
  ];

  const completion = await callOpenAIWithRetry({
    model: 'gpt-4o',
    messages,
    max_tokens: 1000,
    temperature: 0.8,
    top_p: 1.0,
    frequency_penalty: 0.4
  });

  return `💡 **Brainstorm Results:**\n\n${completion.choices[0].message.content}`;
  } catch (error) {
    console.error('Brainstorm Mode error:', error);
    return "💡 Brainstorm mode is temporarily unavailable. Please try again or use regular chat.";
  }
}

async function handlePlanCommand(sender, content) {
  try {
    validateInput(sender, content, 'text');
    const query = content.replace('/plan', '').trim();
    if (!query) {
    return "📋 **Planning Assistant**\n\nWhat project or goal would you like help planning?\n\nExample: `/plan Launch a new website in 3 months`";
  }

  const messages = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nYou are in PLANNING MODE. Create detailed, actionable project plans with clear phases, milestones, and timelines. Consider resources, risks, and dependencies. Present plans in structured, easy-to-follow formats.`
    },
    { role: 'user', content: query }
  ];

  const completion = await callOpenAIWithRetry({
    model: 'gpt-4o',
    messages,
    max_tokens: 1200,
    temperature: 0.4,
    top_p: 0.9
  });

  return `📋 **Strategic Plan:**\n\n${completion.choices[0].message.content}`;
  } catch (error) {
    console.error('Plan Mode error:', error);
    return "📋 Planning mode is temporarily unavailable. Please try again or use regular chat.";
  }
}

async function handleResearchCommand(sender, content) {
  try {
    validateInput(sender, content, 'text');
    const query = content.replace('/research', '').trim();
    if (!query) {
    return "🔬 **Research Assistant**\n\nWhat topic would you like me to research and analyze?\n\nExample: `/research Latest developments in quantum computing`";
  }

  const messages = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\nYou are in RESEARCH MODE. Provide comprehensive research on topics with multiple perspectives, key findings, current trends, and credible insights. Structure information clearly and cite reasoning where possible.`
    },
    { role: 'user', content: query }
  ];

  const completion = await callOpenAIWithRetry({
    model: 'gpt-4o',
    messages,
    max_tokens: 1200,
    temperature: 0.5,
    top_p: 0.9
  });

  return `🔬 **Research Findings:**\n\n${completion.choices[0].message.content}`;
  } catch (error) {
    console.error('Research Mode error:', error);
    return "🔬 Research mode is temporarily unavailable. Please try again or use regular chat.";
  }
}

module.exports = {
  processMessage,
  summarizeConversation,
  generateCreativeResponse,
  analyzeSentiment,
  generateSuggestedReplies
};