🎥 KMB Video Chat
Групповой видеочат без регистрации. Создайте комнату, поделитесь ссылкой – и до 4 участников могут общаться по видео и тексту в реальном времени. Хост управляет комнатой, гости подключаются по ссылке.

Деплой: vibecall-frontend-9m76.onrender.com (фронтенд)
Backend API: vibecall-backend-5791.onrender.com

📦 Стек технологий
Компонент	Технологии
Фронтенд	React 18, TypeScript, Vite, React Router, Zustand, Socket.IO-client
Бэкенд	Node.js 22, TypeScript, Express, Socket.IO, Zod
Медиасервер	LiveKit Cloud (WebRTC SFU)
Деплой	Render (Static Site для фронта, Web Service для бэка)
Сеть	REST API + WebSockets (Socket.IO для чата/присутствия)
Контейнеризация (локально)	Docker Compose
✨ Функциональность
Создание комнаты с уникальной ссылкой (хост – первый участник).

Подключение гостей по ссылке (до 4 участников).

Видео и аудио в реальном времени через WebRTC (LiveKit).

Текстовый чат с прикреплением файлов (до 10 МБ на файл, до 5 файлов за сообщение).

Автоматическое определение роли: хост (по токену в URL) или гость.

Grace-период после ухода хоста (по умолчанию 60 секунд) – участники могут перезагрузить страницу или присоединиться позже.

Состояния комнаты: active, ended, full, not-found.

🏗 Архитектура
Проект состоит из трёх основных частей:

Фронтенд – одностраничное приложение (SPA) на React. Отвечает за интерфейс, подключение к LiveKit и Socket.IO, управление состоянием.

Бэкенд – REST API и WebSocket-сервер (Socket.IO). Управляет комнатами, участниками, grace-периодом, вебхуками от LiveKit, чатом и вложениями.

LiveKit – медиасервер, который обрабатывает видео/аудио потоки. Используется облачная версия (LiveKit Cloud).

Схема взаимодействия










Фронтенд обращается к бэкенду по REST для создания/присоединения к комнате, получает токен для LiveKit.

Бэкенд создаёт комнату в LiveKit через Admin API, управляет grace-периодом, обрабатывает вебхуки от LiveKit (участник вышел, комната завершена).

LiveKit отправляет вебхуки на бэкенд при событиях (например, participant_left, room_finished), что запускает grace-таймер.

🚀 Локальный запуск (разработка)
Требования
Node.js 22+

Docker и Docker Compose (для запуска LiveKit и бэкенда)

npm или yarn

Шаги
Клонируйте репозиторий

bash
git clone https://github.com/ваш-аккаунт/kmb-video-chat.git
cd kmb-video-chat
Настройте переменные окружения
Создайте файл .env в корне (или используйте значения из docker-compose.yml). Для локальной разработки подойдут дефолтные:

text
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_HOST=http://livekit:7880
PORT=3000
CORS_ORIGIN=http://localhost:5173
GRACE_TIMEOUT_SECONDS=60
Запустите все сервисы через Docker Compose

bash
docker compose up --build
Это поднимет:

LiveKit на портах 7880 (WebSocket/HTTP), 7881 (TCP RTC), 7882 (UDP RTC)

Бэкенд на 3000

Фронтенд (Vite dev-сервер) на 5173

Откройте браузер – http://localhost:5173

Важно: При локальной разработке LiveKit запускается в Docker-контейнере с флагом --dev, что позволяет использовать дефолтные ключи devkey/secret. Бэкенд внутри Docker-сети обращается к LiveKit по имени livekit:7880.

🌍 Деплой на Render
Проект развёрнут на платформе Render с использованием двух сервисов:

Фронтенд – Static Site (сборка через npm run build, папка dist).

Бэкенд – Web Service (Node.js, запуск через npm start).

Переменные окружения для бэкенда (обязательные)
Переменная	Значение
LIVEKIT_API_KEY	API ключ из LiveKit Cloud
LIVEKIT_API_SECRET	Секрет из LiveKit Cloud
LIVEKIT_URL	wss://ваш-проект.livekit.cloud
LIVEKIT_HOST	https://ваш-проект.livekit.cloud
CORS_ORIGIN	URL вашего фронтенда на Render (например, https://vibecall-frontend-9m76.onrender.com)
GRACE_TIMEOUT_SECONDS	Рекомендуется 300 (5 минут) – см. раздел "Особенности"
Переменные для фронтенда (Static Site)
Переменная	Значение
VITE_API_BASE_URL	URL бэкенда (например, https://vibecall-backend-5791.onrender.com)
Настройка LiveKit Cloud
Создайте проект в LiveKit Cloud.

В разделе Settings → Webhooks укажите URL вебхука:

text
https://ваш-бэкенд.onrender.com/webhooks/livekit
Включите все события (или хотя бы participant_left, room_finished).

🔧 Ключевые технические особенности
Grace-период (мягкое завершение комнаты)
При уходе хоста бэкенд запускает grace-таймер на GRACE_TIMEOUT_SECONDS (по умолчанию 60 секунд).

В течение этого времени участники могут перезагрузить страницу или новый гость может присоединиться.

По истечении grace комната удаляется из LiveKit и помечается как ended.

Вебхуки от LiveKit
Бэкенд принимает вебхуки на /webhooks/livekit.

Используется express.raw() для проверки подписи – поэтому этот middleware подключён до express.json().

Обрабатываются события participant_left (запуск grace) и room_finished (резервный запуск grace).

Работа с вложениями в чате
Файлы сохраняются на диске бэкенда в папке uploads.

Ограничения: 10 МБ на файл, до 5 файлов за сообщение.

При удалении комнаты все связанные вложения удаляются автоматически.

CORS
Бэкенд разрешает запросы только с CORS_ORIGIN (строго задаётся переменной окружения).

Socket.IO
Используется для чата и присутствия (онлайн-статус, уведомления).

Интегрирован с HTTP-сервером Express: io.attach(httpServer).

Структура проекта (основные папки)
text
kmb-video-chat/
├── backend/
│   ├── src/
│   │   ├── config.ts          # Валидация переменных окружения
│   │   ├── server.ts          # Точка входа, инициализация зависимостей
│   │   ├── app.ts             # Express-приложение, middleware, роуты
│   │   ├── livekitAdmin.ts    # Взаимодействие с LiveKit API
│   │   ├── webhooks.ts        # Обработка вебхуков от LiveKit
│   │   ├── grace.ts           # Grace-период (таймер, удаление)
│   │   ├── rooms.ts           # In-memory реестр комнат
│   │   ├── routes/            # REST-эндпоинты (rooms, chat, attachments)
│   │   ├── socket.ts          # Socket.IO сервер
│   │   └── ...
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── RoomPage.tsx   # Основная страница комнаты
│   │   ├── features/          # Фичи (prejoin, call, chat, room-states)
│   │   ├── stores/            # Zustand сторы (connection, media, chat, participants)
│   │   ├── shared/            # API клиент, типы, утилиты
│   │   └── ...
│   ├── Dockerfile.dev
│   └── package.json
├── docker-compose.yml         # Для локальной разработки
├── livekit.dev.yaml           # Конфиг для LiveKit (webhook)
└── README.md
📝 Лицензия
MIT (или ваша лицензия – укажите свою).

🙏 Благодарности
LiveKit – за отличный медиасервер.

Render – за простой деплой.
