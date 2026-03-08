# Быстрая установка TURN сервера на вашем сервере

## Зачем нужен TURN?

**STUN** (сейчас используется) - работает только если:
- ✅ Оба участника в одной сети (дом, офис)
- ✅ Хотя бы один участник имеет публичный IP
- ✅ Простой NAT без жесткого firewall

**TURN** (нужен для продакшена) - работает всегда:
- ✅ Разные сети (дом → дом)
- ✅ За NAT/firewall
- ✅ Корпоративные сети
- ✅ Мобильный интернет

---

## Установка на ВАШ сервер (где video.api)

### Вариант 1: Docker (самый простой)

#### 1. Создайте файл `docker-compose.turn.yml` на сервере:

```yaml
version: '3'

services:
  coturn:
    image: coturn/coturn:latest
    network_mode: host
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf
    restart: unless-stopped
```

#### 2. Создайте файл `turnserver.conf`:

```conf
# Слушаем на этих портах
listening-port=3478
tls-listening-port=5349

# Укажите публичный IP вашего сервера
external-ip=YOUR_SERVER_PUBLIC_IP

# Realm (замените на ваш домен или IP)
realm=your-domain.com

# Включаем аутентификацию
lt-cred-mech

# Создайте пользователя (замените на свои данные!)
user=myusername:mypassword

# Логирование
verbose
log-file=/var/log/turnserver.log

# Безопасность
fingerprint
no-multicast-peers
```

#### 3. Запустите TURN сервер:

```bash
# Замените YOUR_SERVER_PUBLIC_IP на реальный IP
sed -i 's/YOUR_SERVER_PUBLIC_IP/5.185.139.31/g' turnserver.conf

# Запуск
docker-compose -f docker-compose.turn.yml up -d

# Проверка логов
docker-compose -f docker-compose.turn.yml logs -f
```

#### 4. Откройте порты в firewall:

```bash
# Ubuntu/Debian
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3478/tcp
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --permanent --add-port=5349/udp
sudo firewall-cmd --reload
```

---

### Вариант 2: Без Docker

```bash
# Установка
sudo apt update
sudo apt install coturn -y

# Включение
sudo systemctl enable coturn
sudo systemctl start coturn

# Конфигурация (см. выше turnserver.conf)
sudo nano /etc/turnserver.conf

# Перезапуск
sudo systemctl restart coturn

# Статус
sudo systemctl status coturn
```

---

## Обновление фронтенда

После запуска TURN сервера, обновите `lib/webrtc.ts`:

```typescript
private config: RTCConfiguration = {
  iceServers: [
    // STUN
    { urls: 'stun:stun.l.google.com:19302' },
    
    // ВАШ TURN сервер
    {
      urls: 'turn:your-domain.com:3478',  // или IP
      username: 'myusername',              // из turnserver.conf
      credential: 'mypassword'
    },
    {
      urls: 'turns:your-domain.com:5349',  // TLS
      username: 'myusername',
      credential: 'mypassword'
    }
  ]
};
```

**Или через переменные окружения** (рекомендуется):

`.env.local`:
```env
NEXT_PUBLIC_TURN_URL=turn:your-domain.com:3478
NEXT_PUBLIC_TURN_USERNAME=myusername
NEXT_PUBLIC_TURN_PASSWORD=mypassword
```

`lib/webrtc.ts`:
```typescript
private config: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    ...(process.env.NEXT_PUBLIC_TURN_URL ? [{
      urls: process.env.NEXT_PUBLIC_TURN_URL,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
      credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || ''
    }] : [])
  ]
};
```

---

## Проверка что TURN работает

### 1. Тест с командной строки:

```bash
# Установите утилиту
sudo apt install stuntman-client

# Проверка
stunclient your-domain.com 3478
```

### 2. Онлайн тест:

https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

Добавьте ваш TURN сервер и проверьте появление `relay` кандидатов.

### 3. В консоли браузера:

После подключения ищите:
```
🔥 relay (TURN) udp  ← TURN работает!
```

---

## Стоимость

**Сервер:** VPS уже есть (где video.api)  
**Дополнительно:** $0  
**Трафик:** ~500 МБ на час звонка (обычно включен в VPS)

---

## Безопасность

### Генерация надежного пароля:

```bash
openssl rand -base64 32
```

### Ротация credentials (опционально):

Вместо статического пароля можно генерировать временные:

```javascript
// На бэкенде (video.api)
const crypto = require('crypto');

function generateTURNCredentials(username, secret) {
  const timestamp = Math.floor(Date.now() / 1000) + 24 * 3600; // 24 часа
  const turnUsername = `${timestamp}:${username}`;
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(turnUsername);
  const turnPassword = hmac.digest('base64');
  
  return { username: turnUsername, password: turnPassword };
}

// API endpoint
app.get('/api/turn-credentials', (req, res) => {
  const creds = generateTURNCredentials('user', 'your-secret-key');
  res.json({
    urls: 'turn:your-domain.com:3478',
    username: creds.username,
    credential: creds.password
  });
});
```

---

## Траблшутинг

### TURN не работает:

1. **Проверьте порты:**
   ```bash
   sudo netstat -tulpn | grep 3478
   ```

2. **Проверьте логи:**
   ```bash
   # Docker
   docker-compose -f docker-compose.turn.yml logs
   
   # Без Docker
   sudo tail -f /var/log/turnserver.log
   ```

3. **Проверьте IP:**
   ```bash
   curl ifconfig.me
   # Этот IP должен быть в external-ip
   ```

4. **Firewall:**
   ```bash
   sudo ufw status
   ```

---

## Итог

✅ Устанавливаете на ТОТ ЖЕ сервер где video.api  
✅ Используете СВОЙ сервер, СВОИ credentials  
✅ Никаких внешних сервисов  
✅ Полный контроль  
✅ Бесплатно (трафик обычно включен в VPS)
