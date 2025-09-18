/**
 * Ultra-Modern Emoji Picker for Talk pAI
 * Glass morphism design with categories and search
 */

class EmojiPicker {
    constructor() {
        this.isOpen = false;
        this.categories = {
            recent: { name: 'Recently Used', icon: '🕒', emojis: [] },
            people: { name: 'Smileys & People', icon: '😀', emojis: [
                '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
                '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
                '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
                '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶',
                '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮',
                '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
                '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀',
                '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻',
                '😼', '😽', '🙀', '😿', '😾'
            ]},
            nature: { name: 'Animals & Nature', icon: '🐱', emojis: [
                '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷',
                '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥',
                '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
                '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑',
                '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆',
                '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄',
                '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓',
                '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁',
                '🐀', '🐿️', '🦔'
            ]},
            food: { name: 'Food & Drink', icon: '🍕', emojis: [
                '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
                '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕',
                '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🍳', '🧈', '🥞',
                '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙',
                '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣',
                '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧',
                '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪',
                '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺',
                '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾'
            ]},
            activity: { name: 'Activity', icon: '⚽', emojis: [
                '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸',
                '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋',
                '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️',
                '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️',
                '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘',
                '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️',
                '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️',
                '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
                '🎫', '🎟️', '🎪', '🤹', '🤹‍♀️', '🤹‍♂️', '🎭', '🩰', '🎨', '🎬', '🎤',
                '🎧', '🎼', '🎵', '🎶', '🥁', '🪘', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♠️',
                '♥️', '♦️', '♣️', '♟️', '🃏', '🀄', '🎴'
            ]},
            travel: { name: 'Travel & Places', icon: '✈️', emojis: [
                '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛',
                '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡',
                '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊',
                '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤',
                '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼',
                '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️',
                '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬',
                '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🛕',
                '🕍', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆',
                '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁'
            ]},
            objects: { name: 'Objects', icon: '💡', emojis: [
                '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾',
                '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠',
                '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡',
                '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷',
                '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪓',
                '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️',
                '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭',
                '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹',
                '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴',
                '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛏️', '🛋️', '🪞', '🪟', '🚿', '🛁', '🚽', '🧻',
                '🧽', '🪣', '🧴', '🧷', '🧹', '🧺', '🔦'
            ]},
            symbols: { name: 'Symbols', icon: '❤️', emojis: [
                '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
                '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯',
                '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
                '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸',
                '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲',
                '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫',
                '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓',
                '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️',
                '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧',
                '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼',
                '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗',
                '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣',
                '8️⃣', '9️⃣', '🔟'
            ]},
            flags: { name: 'Flags', icon: '🏁', emojis: [
                '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩',
                '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸',
                '🇦🇹', '🇦🇺', '🇦🇼', '🇦🇽', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫',
                '🇧🇬', '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷',
                '🇧🇸', '🇧🇹', '🇧🇻', '🇧🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨', '🇨🇩', '🇨🇫',
                '🇨🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '🇨🇳', '🇨🇴', '🇨🇵', '🇨🇷',
                '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽', '🇨🇾', '🇨🇿', '🇩🇪', '🇩🇬', '🇩🇯', '🇩🇰',
                '🇩🇲', '🇩🇴', '🇩🇿', '🇪🇦', '🇪🇨', '🇪🇪', '🇪🇬', '🇪🇭', '🇪🇷', '🇪🇸',
                '🇪🇹', '🇪🇺', '🇫🇮', '🇫🇯', '🇫🇰', '🇫🇲', '🇫🇴', '🇫🇷', '🇬🇦', '🇬🇧',
                '🇬🇩', '🇬🇪', '🇬🇫', '🇬🇬', '🇬🇭', '🇬🇮', '🇬🇱', '🇬🇲', '🇬🇳', '🇬🇵',
                '🇬🇶', '🇬🇷', '🇬🇸', '🇬🇹', '🇬🇺', '🇬🇼', '🇬🇾', '🇭🇰', '🇭🇲', '🇭🇳',
                '🇭🇷', '🇭🇹', '🇭🇺', '🇮🇨', '🇮🇩', '🇮🇪', '🇮🇱', '🇮🇲', '🇮🇳', '🇮🇴',
                '🇮🇶', '🇮🇷', '🇮🇸', '🇮🇹', '🇯🇪', '🇯🇲', '🇯🇴', '🇯🇵', '🇰🇪', '🇰🇬',
                '🇰🇭', '🇰🇮', '🇰🇲', '🇰🇳', '🇰🇵', '🇰🇷', '🇰🇼', '🇰🇾', '🇰🇿', '🇱🇦',
                '🇱🇧', '🇱🇨', '🇱🇮', '🇱🇰', '🇱🇷', '🇱🇸', '🇱🇹', '🇱🇺', '🇱🇻', '🇱🇾',
                '🇲🇦', '🇲🇨', '🇲🇩', '🇲🇪', '🇲🇫', '🇲🇬', '🇲🇭', '🇲🇰', '🇲🇱', '🇲🇲',
                '🇲🇳', '🇲🇴', '🇲🇵', '🇲🇶', '🇲🇷', '🇲🇸', '🇲🇹', '🇲🇺', '🇲🇻', '🇲🇼',
                '🇲🇽', '🇲🇾', '🇲🇿', '🇳🇦', '🇳🇨', '🇳🇪', '🇳🇫', '🇳🇬', '🇳🇮', '🇳🇱',
                '🇳🇴', '🇳🇵', '🇳🇷', '🇳🇺', '🇳🇿', '🇴🇲', '🇵🇦', '🇵🇪', '🇵🇫', '🇵🇬',
                '🇵🇭', '🇵🇰', '🇵🇱', '🇵🇲', '🇵🇳', '🇵🇷', '🇵🇸', '🇵🇹', '🇵🇼', '🇵🇾',
                '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇸', '🇷🇺', '🇷🇼', '🇸🇦', '🇸🇧', '🇸🇨', '🇸🇩',
                '🇸🇪', '🇸🇬', '🇸🇭', '🇸🇮', '🇸🇯', '🇸🇰', '🇸🇱', '🇸🇲', '🇸🇳', '🇸🇴',
                '🇸🇷', '🇸🇸', '🇸🇹', '🇸🇻', '🇸🇽', '🇸🇾', '🇸🇿', '🇹🇦', '🇹🇨', '🇹🇩',
                '🇹🇫', '🇹🇬', '🇹🇭', '🇹🇯', '🇹🇰', '🇹🇱', '🇹🇲', '🇹🇳', '🇹🇴', '🇹🇷',
                '🇹🇹', '🇹🇻', '🇹🇼', '🇹🇿', '🇺🇦', '🇺🇬', '🇺🇲', '🇺🇳', '🇺🇸', '🇺🇾',
                '🇺🇿', '🇻🇦', '🇻🇨', '🇻🇪', '🇻🇬', '🇻🇮', '🇻🇳', '🇻🇺', '🇼🇫', '🇼🇸',
                '🇽🇰', '🇾🇪', '🇾🇹', '🇿🇦', '🇿🇲', '🇿🇼'
            ]}
        };

        this.recentEmojis = JSON.parse(localStorage.getItem('talkpai-recent-emojis') || '[]');
        this.categories.recent.emojis = this.recentEmojis;

        this.currentCategory = 'recent';
        this.searchTerm = '';
        this.onEmojiSelect = null;

        this.init();
    }

    init() {
        this.createEmojiPicker();
        this.bindEvents();
    }

    createEmojiPicker() {
        const picker = document.createElement('div');
        picker.id = 'emojiPicker';
        picker.className = 'emoji-picker';
        picker.style.display = 'none';

        picker.innerHTML = `
            <div class="emoji-picker-modal glass-effect">
                <div class="emoji-picker-header">
                    <div class="emoji-search-container">
                        <input type="text"
                               class="emoji-search"
                               id="emojiSearch"
                               placeholder="Search emojis...">
                        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>
                    <button class="emoji-close-btn" id="emojiCloseBtn">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>

                <div class="emoji-categories">
                    ${Object.keys(this.categories).map(key => {
                        const category = this.categories[key];
                        return `
                            <button class="emoji-category-btn ${key === 'recent' ? 'active' : ''}"
                                    data-category="${key}"
                                    title="${category.name}">
                                ${category.icon}
                            </button>
                        `;
                    }).join('')}
                </div>

                <div class="emoji-content" id="emojiContent">
                    <div class="emoji-grid" id="emojiGrid">
                        <!-- Emojis will be populated here -->
                    </div>
                </div>

                <div class="emoji-picker-footer">
                    <div class="emoji-preview" id="emojiPreview">
                        <span class="preview-emoji"></span>
                        <span class="preview-name">Choose an emoji</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(picker);
        this.addEmojiPickerStyles();
        this.loadCategory('recent');
    }

    addEmojiPickerStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .emoji-picker {
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                animation: slideUpEmoji 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .emoji-picker-modal {
                width: 350px;
                height: 420px;
                background: var(--glass-bg);
                backdrop-filter: blur(var(--glass-blur));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }

            .emoji-picker-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .emoji-search-container {
                flex: 1;
                position: relative;
                display: flex;
                align-items: center;
            }

            .emoji-search {
                width: 100%;
                background: var(--glass-bg);
                backdrop-filter: blur(var(--glass-blur));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 8px 12px 8px 32px;
                color: var(--text-primary);
                font-size: 14px;
                outline: none;
                transition: all 0.3s;
            }

            .emoji-search:focus {
                border-color: var(--primary-color);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .emoji-search::placeholder {
                color: var(--text-secondary);
            }

            .search-icon {
                position: absolute;
                left: 10px;
                color: var(--text-secondary);
                pointer-events: none;
            }

            .emoji-close-btn {
                width: 32px;
                height: 32px;
                background: none;
                border: none;
                border-radius: 8px;
                color: var(--text-secondary);
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .emoji-close-btn:hover {
                background: var(--glass-bg);
                color: var(--primary-color);
            }

            .emoji-categories {
                display: flex;
                padding: 8px 16px;
                gap: 4px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                overflow-x: auto;
            }

            .emoji-categories::-webkit-scrollbar {
                display: none;
            }

            .emoji-category-btn {
                min-width: 36px;
                height: 36px;
                background: none;
                border: none;
                border-radius: 8px;
                font-size: 18px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .emoji-category-btn:hover {
                background: var(--glass-bg);
                transform: scale(1.1);
            }

            .emoji-category-btn.active {
                background: var(--primary-color);
                transform: scale(1.1);
            }

            .emoji-content {
                flex: 1;
                overflow: hidden;
                position: relative;
            }

            .emoji-grid {
                display: grid;
                grid-template-columns: repeat(8, 1fr);
                gap: 4px;
                padding: 12px;
                height: 100%;
                overflow-y: auto;
            }

            .emoji-grid::-webkit-scrollbar {
                width: 6px;
            }

            .emoji-grid::-webkit-scrollbar-track {
                background: transparent;
            }

            .emoji-grid::-webkit-scrollbar-thumb {
                background: var(--glass-bg);
                border-radius: 3px;
                backdrop-filter: blur(10px);
            }

            .emoji-btn {
                width: 32px;
                height: 32px;
                background: none;
                border: none;
                border-radius: 8px;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                user-select: none;
            }

            .emoji-btn:hover {
                background: var(--glass-bg);
                transform: scale(1.2);
                border-radius: 50%;
            }

            .emoji-picker-footer {
                padding: 12px 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .emoji-preview {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .preview-emoji {
                font-size: 24px;
                min-width: 32px;
                text-align: center;
            }

            .preview-name {
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
            }

            .no-emojis {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: var(--text-secondary);
                font-size: 14px;
                gap: 8px;
            }

            .no-emojis-icon {
                font-size: 32px;
                opacity: 0.5;
            }

            @keyframes slideUpEmoji {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0) scale(1);
                }
            }

            @media (max-width: 768px) {
                .emoji-picker {
                    left: 16px;
                    right: 16px;
                    bottom: 16px;
                    transform: none;
                }

                .emoji-picker-modal {
                    width: 100%;
                    max-width: calc(100vw - 32px);
                }
            }
        `;

        document.head.appendChild(styles);
    }

    bindEvents() {
        // Close picker
        document.getElementById('emojiCloseBtn')?.addEventListener('click', () => {
            this.hide();
        });

        // Search functionality
        document.getElementById('emojiSearch')?.addEventListener('input', (e) => {
            this.searchEmojis(e.target.value);
        });

        // Category switching
        document.querySelectorAll('.emoji-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                this.switchCategory(category);
            });
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.isOpen && !e.target.closest('.emoji-picker') && !e.target.closest('.emoji-button')) {
                this.hide();
            }
        });
    }

    show(onSelect) {
        this.onEmojiSelect = onSelect;
        document.getElementById('emojiPicker').style.display = 'block';
        this.isOpen = true;

        // Focus search input
        setTimeout(() => {
            document.getElementById('emojiSearch')?.focus();
        }, 100);
    }

    hide() {
        document.getElementById('emojiPicker').style.display = 'none';
        this.isOpen = false;
        this.searchTerm = '';
        document.getElementById('emojiSearch').value = '';
    }

    switchCategory(category) {
        this.currentCategory = category;
        this.searchTerm = '';
        document.getElementById('emojiSearch').value = '';

        // Update active category button
        document.querySelectorAll('.emoji-category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        this.loadCategory(category);
    }

    loadCategory(category) {
        const grid = document.getElementById('emojiGrid');
        const emojis = this.categories[category].emojis;

        if (emojis.length === 0 && category === 'recent') {
            grid.innerHTML = `
                <div class="no-emojis">
                    <div class="no-emojis-icon">😊</div>
                    <div>No recent emojis</div>
                    <div style="font-size: 12px; opacity: 0.7;">Your recently used emojis will appear here</div>
                </div>
            `;
            return;
        }

        grid.innerHTML = emojis.map(emoji => `
            <button class="emoji-btn"
                    data-emoji="${emoji}"
                    title="${this.getEmojiName(emoji)}">
                ${emoji}
            </button>
        `).join('');

        // Bind emoji click events
        grid.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectEmoji(btn.dataset.emoji);
            });

            btn.addEventListener('mouseenter', () => {
                this.previewEmoji(btn.dataset.emoji);
            });
        });
    }

    searchEmojis(term) {
        this.searchTerm = term.toLowerCase();
        const grid = document.getElementById('emojiGrid');

        if (!term.trim()) {
            this.loadCategory(this.currentCategory);
            return;
        }

        // Search across all categories
        const allEmojis = Object.keys(this.categories)
            .filter(key => key !== 'recent')
            .flatMap(key => this.categories[key].emojis);

        const results = allEmojis.filter(emoji => {
            const name = this.getEmojiName(emoji).toLowerCase();
            return name.includes(term) || emoji === term;
        });

        if (results.length === 0) {
            grid.innerHTML = `
                <div class="no-emojis">
                    <div class="no-emojis-icon">🔍</div>
                    <div>No emojis found</div>
                    <div style="font-size: 12px; opacity: 0.7;">Try a different search term</div>
                </div>
            `;
            return;
        }

        grid.innerHTML = results.map(emoji => `
            <button class="emoji-btn"
                    data-emoji="${emoji}"
                    title="${this.getEmojiName(emoji)}">
                ${emoji}
            </button>
        `).join('');

        // Bind emoji click events
        grid.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectEmoji(btn.dataset.emoji);
            });

            btn.addEventListener('mouseenter', () => {
                this.previewEmoji(btn.dataset.emoji);
            });
        });
    }

    selectEmoji(emoji) {
        // Add to recent emojis
        this.addToRecent(emoji);

        // Call the callback
        if (this.onEmojiSelect) {
            this.onEmojiSelect(emoji);
        }

        this.hide();
    }

    addToRecent(emoji) {
        // Remove if already exists
        this.recentEmojis = this.recentEmojis.filter(e => e !== emoji);

        // Add to beginning
        this.recentEmojis.unshift(emoji);

        // Keep only last 32 emojis
        this.recentEmojis = this.recentEmojis.slice(0, 32);

        // Update category
        this.categories.recent.emojis = this.recentEmojis;

        // Save to localStorage
        localStorage.setItem('talkpai-recent-emojis', JSON.stringify(this.recentEmojis));
    }

    previewEmoji(emoji) {
        const preview = document.getElementById('emojiPreview');
        if (preview) {
            preview.querySelector('.preview-emoji').textContent = emoji;
            preview.querySelector('.preview-name').textContent = this.getEmojiName(emoji);
        }
    }

    getEmojiName(emoji) {
        // Simple emoji name mapping (you could use a more comprehensive emoji database)
        const emojiNames = {
            '😀': 'grinning face',
            '😃': 'grinning face with big eyes',
            '😄': 'grinning face with smiling eyes',
            '😁': 'beaming face with smiling eyes',
            '😆': 'grinning squinting face',
            '😅': 'grinning face with sweat',
            '🤣': 'rolling on the floor laughing',
            '😂': 'face with tears of joy',
            '🙂': 'slightly smiling face',
            '🙃': 'upside down face',
            '😉': 'winking face',
            '😊': 'smiling face with smiling eyes',
            '😇': 'smiling face with halo',
            '🥰': 'smiling face with hearts',
            '😍': 'smiling face with heart eyes',
            '🤩': 'star struck',
            '😘': 'face blowing a kiss',
            '😗': 'kissing face',
            '❤️': 'red heart',
            '💙': 'blue heart',
            '💚': 'green heart',
            '💛': 'yellow heart',
            '🧡': 'orange heart',
            '💜': 'purple heart',
            '🖤': 'black heart',
            '🤍': 'white heart',
            '🤎': 'brown heart',
            '👍': 'thumbs up',
            '👎': 'thumbs down',
            '👏': 'clapping hands',
            '🙌': 'raising hands',
            '🔥': 'fire',
            '💯': 'hundred points',
            '✨': 'sparkles',
            '⭐': 'star',
            '🌟': 'glowing star',
            '💫': 'dizzy',
            '🎉': 'party popper',
            '🎊': 'confetti ball',
            '🚀': 'rocket',
            '⚡': 'high voltage'
        };

        return emojiNames[emoji] || `emoji ${emoji}`;
    }
}

// Initialize emoji picker
window.emojiPicker = new EmojiPicker();