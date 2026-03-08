# Настройка TURN сервера

## Проблема

Когда участники видео-звонка находятся в **разных сетях** за NAT/firewall, STUN сервера недостаточно. Нужен **TURN сервер** для проброса трафика.

### Когда STUN работает:
- ✅ Оба участника в одной локальной сети
- ✅ Один из участников имеет публичный IP
- ✅ Простой NAT без strict firewall

### Когда нужен TURN:
- ⚠️ Оба участника за разными NAT
- ⚠️ Корпоративные сети / VPN
- ⚠️ Мобильные сети операторов
- ⚠️ Symmetric NAT

## Текущее решение (для тестирования)

Временно используется публичный TURN сервер:
```javascript
{
  urls: 'turn:openrelay.metered.ca:80',
  username: 'openrelayproject',
  credential: 'openrelayproject'
}
```

⚠️ **НЕ используйте публичные TURN серверы на продакшене!**
- Низкая скорость
- Могут отключиться в любой момент
- Нет гарантий доступности

## Production решения

### Вариант 1: Собственный TURN сервер (coturn)

#### Установка на Ubuntu/Debian

```bash
# Установка coturn
sudo apt update
sudo apt install coturn

# Включение сервиса
sudo systemctl enable coturn
```

#### Конфигурация `/etc/turnserver.conf`

```conf
# Основные настройки
listening-port=3478
tls-listening-port=5349

# Внешний IP вашего сервера
external-ip=YOUR_SERVER_PUBLIC_IP

# Realm (домен)
realm=yourdomain.com

# Аутентификация
lt-cred-mech
user=username:password

# Безопасность
fingerprint
no-multicast-peers

# Логирование
verbose
log-file=/var/log/turnserver.log
```

#### Запуск

```bash
sudo systemctl start coturn
sudo systemctl status coturn
```

#### Обновление фронтенда

В `lib/webrtc.ts`:

```typescript
private config: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:yourdomain.com:3478',
      username: 'username',
      credential: 'password'
    },
    {
      urls: 'turns:yourdomain.com:5349', // TLS
      username: 'username',
      credential: 'password'
    }
  ]
};
```

### Вариант 2: Облачные TURN сервисы

#### Twilio TURN

```javascript
// Получение токена с бэкенда
const response = await fetch('https://your-api.com/get-turn-credentials');
const { iceServers } = await response.json();

// Используем в RTCPeerConnection
const config = { iceServers };
```

**Преимущества:**
- Глобальная сеть серверов
- Автоматическое масштабирование
- Мониторинг и аналитика
- От $0.0004 за минуту

**Недостатки:**
- Платно
- Зависимость от третьей стороны

#### Metered.ca

Аналогично Twilio, API для получения credentials:

```bash
curl -X POST https://yourusername.metered.live/api/v1/turn/credentials?apiKey=your_api_key
```

### Вариант 3: Использовать переменные окружения

Создайте `.env.local`:

```env
NEXT_PUBLIC_TURN_URL=turn:yourdomain.com:3478
NEXT_PUBLIC_TURN_USERNAME=username
NEXT_PUBLIC_TURN_PASSWORD=password
```

Обновите `lib/webrtc.ts`:

```typescript
private config: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: process.env.NEXT_PUBLIC_TURN_URL || 'turn:openrelay.metered.ca:80',
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject',
      credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'openrelayproject'
    }
  ]
};
```

## Проверка работы TURN

### В консоли браузера

После подключения ищите:
```
🧊 ICE connection state: connected
📡 Отправляем ICE candidate: relay udp
```

`relay` означает что используется TURN сервер ✅

### Тест TURN сервера

```bash
# Установка утилиты
sudo apt install stuntman-client

# Тест
stunclient your-turn-server.com 3478
```

### Онлайн тест

https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

Введите ваши TURN credentials и проверьте появляются ли `relay` кандидаты.

## Оценка трафика

- Аудио: ~50 Кбит/с
- Видео 720p: ~1-2 Мбит/с
- 1 час звонка: ~450 МБ - 900 МБ

При 100 одновременных звонках: ~50-100 Гбит/с

## Безопасность

1. **Используйте TLS** (turns://)
2. **Ротация паролей** - генерируйте временные credentials
3. **Rate limiting** - ограничьте количество подключений
4. **Firewall** - открывайте только нужные порты (3478, 5349)
5. **Мониторинг** - отслеживайте трафик и аномалии

## Дополнительные материалы

- [Coturn документация](https://github.com/coturn/coturn)
- [WebRTC для начинающих](https://webrtc.org/getting-started/overview)
- [Понимание ICE, STUN и TURN](https://webrtc.org/getting-started/peer-connections)
