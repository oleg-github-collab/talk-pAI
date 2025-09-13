# 🚀 Railway Deployment Guide for Talk pAI

## 📋 Крок 1: Підготовка Railway проекту

1. **Зайди на [Railway.app](https://railway.app)**
2. **Створи новий проект** - "Deploy from GitHub repo"
3. **Підключи цей репозиторій**

## 🗄️ Крок 2: Додай PostgreSQL базу даних

1. **В проекті натисни "Add Service"**
2. **Вибери "Database" → "PostgreSQL"**
3. **Railway автоматично створить базу і встановить `DATABASE_URL`**

## ⚙️ Крок 3: Налаштуй змінні середовища

**В розділі "Variables" додай:**

### 🔑 Обов'язкові змінні:
```
NODE_ENV=production
OPENAI_API_KEY=твій_openai_api_ключ_тут
```

### 📊 База даних (автоматично):
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### 🔐 Безпека (згенеровані автоматично):
```
JWT_SECRET=твій_jwt_секрет_32_символи_мінімум
ENCRYPTION_KEY=твій_encryption_ключ_32_символи_мінімум
```

### 📁 Додаткові (опційні):
```
GAS_AUDIO_UPLOAD_URL=твій_google_apps_script_url_для_аудіо
```

## 🔧 Крок 4: Деплой конфігурація

Railway автоматично визначить:
- ✅ **Node.js проект**
- ✅ **npm install** для залежностей
- ✅ **npm run build** для setup
- ✅ **node server.js** для старту

## 🎯 Крок 5: Деплой!

1. **Натисни "Deploy"**
2. **Railway автоматично:**
   - Встановить `pg` (PostgreSQL клієнт)
   - Підключиться до бази даних
   - Створить всі таблиці
   - Запустить сервер

## ✅ Перевірка деплою

**Коли деплой завершено, перевір:**
- 🟢 **Service Status**: Running
- 🟢 **Logs**: "✅ PostgreSQL database schema initialized successfully"
- 🟢 **Public URL**: Сайт відкривається без помилок

## 🔍 Можливі проблеми і рішення

### ❌ Database connection error
**Рішення:** Переконайся що PostgreSQL сервіс створено і `DATABASE_URL` встановлена

### ❌ OpenAI API error
**Рішення:** Перевір що `OPENAI_API_KEY` правильний і має кредити

### ❌ Build failed
**Рішення:** Переконайся що всі файли закоммічені в git

## 🎉 Готово!

Твій Talk pAI тепер працює на Railway з PostgreSQL!

**URL:** `https://твій-проект.railway.app`

---

## 💡 Додаткові поради

- **Логи:** Перевіряй в Railway Dashboard → Deployments → View Logs
- **База даних:** Можеш підключитися через DATABASE_URL для перевірки
- **Моніторинг:** Railway показує CPU/Memory usage в реальному часі
- **Custom Domain:** Можна додати власний домен в Settings → Domains

## 🆘 Допомога

Якщо щось не працює:
1. Перевір логи деплою
2. Переконайся що всі змінні середовища встановлені
3. PostgreSQL сервіс має бути в статусі "Running"