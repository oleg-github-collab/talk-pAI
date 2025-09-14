// БЕЗПЕЧНІ ГЛОБАЛЬНІ ФУНКЦІЇ ДЛЯ АВТОРИЗАЦІЇ
console.log('🚀 Auth functions loading...');

// Глобальні функції
window.showRegister = function showRegister() {
  console.log('🔄 Switching to register form');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'flex';
};

window.showLogin = function showLogin() {
  console.log('🔄 Switching to login form');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.style.display = 'none';
  if (loginForm) loginForm.style.display = 'flex';
};

window.login = async function login() {
  console.log('🔐 Login function called');
  const nickname = document.getElementById('loginNickname')?.value?.trim();
  const password = document.getElementById('loginPassword')?.value;

  if (!nickname || !password) {
    alert('Введіть nickname та password');
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password })
    });

    const data = await response.json();
    if (data.success) {
      console.log('✅ Login successful, redirecting...');
      localStorage.setItem('token', data.token);
      localStorage.setItem('nickname', data.nickname);
      localStorage.setItem('avatar', data.avatar || '👤');

      // Показати чат
      showChatAfterLogin();

      // Backup: reload if redirect fails
      setTimeout(() => location.reload(), 1000);
    } else {
      alert('Помилка входу: ' + data.error);
    }
  } catch (error) {
    alert('Помилка з\'єднання: ' + error.message);
  }
};

window.register = async function register() {
  console.log('📝 Register function called');
  const nickname = document.getElementById('regNickname')?.value?.trim();
  const password = document.getElementById('regPassword')?.value;

  if (!nickname || !password) {
    alert('Введіть nickname та password');
    return;
  }

  if (nickname.length < 3) {
    alert('Nickname має бути мінімум 3 символи');
    return;
  }

  if (password.length < 6) {
    alert('Password має бути мінімум 6 символів');
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password })
    });

    const data = await response.json();
    if (data.success) {
      console.log('✅ Registration successful, redirecting...');
      localStorage.setItem('token', data.token || data.user?.token);
      localStorage.setItem('nickname', data.nickname || data.user?.nickname);
      localStorage.setItem('avatar', data.avatar || data.user?.avatar || '👤');

      // Показати чат
      showChatAfterLogin();

      // Backup: reload if redirect fails
      setTimeout(() => location.reload(), 1000);
    } else {
      alert('Помилка реєстрації: ' + data.error);
    }
  } catch (error) {
    alert('Помилка з\'єднання: ' + error.message);
  }
};

// Функція показу чату після авторизації
window.showChatAfterLogin = function() {
  console.log('🔄 Switching to chat screen...');

  // Приховати auth screen
  const authScreen = document.getElementById('authScreen');
  if (authScreen) {
    authScreen.style.display = 'none';
    authScreen.classList.remove('active');
  }

  // Показати chat screen
  const chatScreen = document.getElementById('chatListScreen') || document.getElementById('chatScreen');
  if (chatScreen) {
    chatScreen.style.display = 'flex';
    chatScreen.classList.add('active');
  }

  // Backup: знайти перший доступний екран чату
  const screens = ['chatListScreen', 'chatScreen', 'desktopLayout'];
  for (const screenId of screens) {
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.style.display = 'flex';
      screen.classList.add('active');
      break;
    }
  }
};

console.log('✅ All auth functions loaded successfully');