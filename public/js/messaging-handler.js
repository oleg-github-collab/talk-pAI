/**
 * Talk pAI Messaging Handler
 * Connects UI elements to the messaging service
 */

function handleSendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    const content = messageInput.value.trim();
    if (!content) return;

    // Send message via messaging service
    if (window.messagingService) {
        window.messagingService.sendMessage(content);
        messageInput.value = '';
        messageInput.style.height = 'auto'; // Reset height for auto-resize
    } else {
        console.error('Messaging service not available');
    }
}

// Handle Enter key in message input
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        let typingTimer;
        let isTyping = false;

        messageInput.addEventListener('input', () => {
            // Auto-resize textarea
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

            // Handle typing indicators
            if (window.messagingService) {
                if (!isTyping) {
                    window.messagingService.startTyping();
                    isTyping = true;
                }

                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => {
                    window.messagingService.stopTyping();
                    isTyping = false;
                }, 1000);
            }
        });

        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        messageInput.addEventListener('blur', () => {
            // Stop typing when input loses focus
            if (isTyping && window.messagingService) {
                window.messagingService.stopTyping();
                isTyping = false;
            }
        });
    }

    // Initialize chat interface
    initializeChatInterface();
});

function initializeChatInterface() {
    // Auto-select first chat after a short delay to allow messaging service to load
    setTimeout(() => {
        if (window.messagingService && window.messagingService.chats.size > 0) {
            const firstChatId = Array.from(window.messagingService.chats.keys())[0];
            window.messagingService.selectChat(firstChatId);
        }
    }, 1000);
}

// Make functions available globally
window.handleSendMessage = handleSendMessage;