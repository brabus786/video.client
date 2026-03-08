# Деплой на продакшен

## Проблема
При запуске на продакшене возникала ошибка:
```
WebSocket connection to 'ws://localhost:8081/' failed
```

Это происходит потому, что на продакшене запускался `npm run dev` вместо production сборки.

## Решение

### 1. Настройка переменных окружения

Создайте файл `.env.production` или установите переменные окружения на вашем хостинге:

```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### 2. Запуск на продакшене

**Правильно:**
```bash
npm run build
npm start
```

**Неправильно (не делайте так на продакшене):**
```bash
npm run dev  # ❌ Только для локальной разработки!
```

### 3. Для разных платформ

#### Vercel
- Добавьте переменные окружения в Settings → Environment Variables
- Деплой происходит автоматически при push

#### Heroku
```bash
heroku config:set NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

#### Docker
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Установите переменные окружения для production
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=https://your-backend-url.com

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### VPS / Обычный сервер
```bash
# Установите переменные окружения
export NEXT_PUBLIC_API_URL=https://your-backend-url.com
export NODE_ENV=production

# Соберите и запустите
npm run build
npm start

# Или используйте PM2
pm2 start npm --name "video-client" -- start
```

### 4. Проверка

После деплоя:
1. Откройте DevTools в браузере
2. Не должно быть ошибок WebSocket к localhost
3. Проверьте, что WebSocket подключается к правильному серверу
