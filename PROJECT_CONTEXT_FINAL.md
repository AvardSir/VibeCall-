# VibeCall — Project Context for AI

## 1. Назначение документа

Этот документ содержит структурированный технический контекст проекта VibeCall.

Используй его как основной контекст перед анализом, отладкой, рефакторингом или добавлением функциональности.

Важно:
- не предполагай архитектуру, которой нет в этом документе;
- учитывай существующие решения и ограничения;
- перед изменением архитектуры сначала проверь, действительно ли она требует изменения;
- если предлагаешь изменить существующее поведение, объясни, какое текущее поведение меняется и зачем;
- проект является MVP, поэтому не следует без необходимости добавлять сложность, БД, дополнительные сервисы или CI/CD.

---

# 2. Проект

VibeCall — desktop-first веб-приложение для видеоконференций.

Основной сценарий:

1. Пользователь создаёт комнату.
2. Backend создаёт room и host token.
3. Пользователь получает ссылку на комнату.
4. Другие пользователи входят по ссылке как guests.
5. Backend выдаёт каждому участнику LiveKit access token.
6. LiveKit Cloud обеспечивает передачу audio/video/screen sharing.
7. Backend управляет control-plane логикой:
   - комнаты;
   - роли;
   - lifecycle;
   - host;
   - grace period;
   - chat;
   - attachments;
   - screen sharing state;
   - удаление участников.

Максимальное количество участников: 4.

Регистрация пользователей отсутствует.

---

# 3. Архитектура верхнего уровня

```text
                         ┌─────────────────────┐
                         │       Browser       │
                         │                     │
                         │ React + TypeScript  │
                         │ Vite                │
                         │ LiveKit Components  │
                         └──────────┬──────────┘
                                    │
                         HTTP / Socket.IO
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       Backend       │
                         │                     │
                         │ Node.js             │
                         │ Express             │
                         │ Socket.IO           │
                         │ Room Registry       │
                         └──────────┬──────────┘
                                    │
                         LiveKit Server SDK
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    LiveKit Cloud    │
                         │                     │
                         │ WebRTC / SFU        │
                         └─────────────────────┘

Ключевое разделение:

Frontend

Отвечает за:

UI;
prejoin;
conference interface;
audio/video controls;
screen sharing UI;
chat UI;
attachments UI;
participant UI;
preferences;
localization;
взаимодействие с backend API;
Socket.IO client;
подключение к LiveKit.
Backend

Является control plane.

Отвечает за:

создание комнат;
проверку host token;
определение host/guest;
выдачу LiveKit access tokens;
хранение состояния комнат;
lifecycle комнат;
grace period;
удаление участников;
chat state;
attachment authorization;
screen sharing state;
обработку LiveKit webhooks.
LiveKit Cloud

Отвечает за media plane:

audio;
video;
WebRTC;
screen sharing;
SFU routing;
media connections.

Backend НЕ передаёт через себя audio/video.

4. Технологический стек
Frontend
React
TypeScript
Vite
LiveKit Components React SDK
Tailwind CSS
Socket.IO Client
react-i18next
Zod
url-join
Backend
Node.js 22+
TypeScript
Express 5
Socket.IO
LiveKit Server SDK
Zod
Multer
Pino
dotenv
Infrastructure
LiveKit Cloud
Render
Docker
GitHub

CI/CD через GitHub Actions НЕ используется.

Render подключён непосредственно к GitHub и автоматически запускает deployment после push.

5. Deployment architecture

Production больше НЕ использует старый GitLab CI/CD deployment.

Текущая схема:

GitHub
   │
   │ push
   ▼
Render
   │
   ├── Frontend — Render Static Site
   │
   └── Backend — Render Docker Service
                │
                ▼
          LiveKit Cloud

Frontend и Backend находятся в Render.

LiveKit SFU полностью вынесен в LiveKit Cloud.

Старый deployment через:

GitLab CI/CD;
docker-compose.develop.yml;
Traefik;
self-hosted LiveKit;
deploy/livekit.Dockerfile;
deploy/livekit.yaml

не является текущим production deployment.

Эти файлы могут оставаться в репозитории как историческая/инфраструктурная конфигурация, но при анализе production необходимо ориентироваться на Render + LiveKit Cloud.

6. Production environment
Backend

Backend получает environment variables:

LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_URL
LIVEKIT_HOST
PORT
CORS_ORIGIN
GRACE_TIMEOUT_SECONDS
ATTACHMENT_STORAGE_PATH

Для production:

LIVEKIT_URL = LiveKit Cloud WebSocket URL
LIVEKIT_HOST = LiveKit Cloud HTTP API URL
CORS_ORIGIN = production frontend URL
Frontend

Используется:

VITE_API_BASE_URL

Это compile-time переменная Vite.

Она встраивается в production bundle во время npm run build.

Поэтому изменение VITE_API_BASE_URL требует нового frontend build/deployment.

7. Local development

Локальная разработка использует Docker Compose:

docker-compose.yml

Сервисы:

frontend
backend
livekit

Local architecture:

Browser
   │
   ├── http://localhost:5173
   │
   ▼
Frontend
   │
   ├── http://localhost:3000
   ▼
Backend
   │
   └── http://livekit:7880
       │
       ▼
     LiveKit

Browser подключается к LiveKit через:

ws://localhost:7880

Backend обращается к LiveKit через:

http://livekit:7880

Local frontend/backend используют hot reload.

Backend:

npm run dev

Frontend:

npm run dev

Docker Compose:

docker compose up --build
8. Repository structure
VibeCall/
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── rooms/
│   │   │       ├── controller.ts
│   │   │       ├── router.ts
│   │   │       └── schemeValidator.ts
│   │   │
│   │   ├── app.ts
│   │   ├── attachments.ts
│   │   ├── chat.ts
│   │   ├── config.ts
│   │   ├── errors.ts
│   │   ├── grace.ts
│   │   ├── identity.ts
│   │   ├── livekitAdmin.ts
│   │   ├── livekitTokens.ts
│   │   ├── logger.ts
│   │   ├── rooms.ts
│   │   ├── server.ts
│   │   ├── socket.ts
│   │   └── webhooks.ts
│   │
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── package.json
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── call/
│   │   │   ├── chat/
│   │   │   ├── preferences/
│   │   │   ├── prejoin/
│   │   │   └── room-states/
│   │   │
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   └── RoomPage.tsx
│   │   │
│   │   └── shared/
│   │       └── lib/
│   │
│   ├── public/
│   ├── package.json
│   └── ...
│
├── deploy/
│   ├── livekit.Dockerfile
│   ├── livekit.yaml
│   └── README.md
│
├── docs/
│   └── screenshots/
│
├── docker-compose.yml
├── docker-compose.develop.yml
├── gitlab-ci.yml
├── package.json
└── ...
9. Backend architecture

Backend создаётся в server.ts.

Основные зависимости:

config
   │
   ├── LiveKit Admin
   ├── Token Minter
   ├── Room Registry
   ├── Chat Service
   ├── Attachment Service
   ├── Socket Server
   ├── Grace Service
   └── Webhook Handler

После создания зависимостей:

Express app
   +
Socket.IO
   +
HTTP server

Socket.IO прикрепляется к HTTP server.

Важно:

server.ts специально использует:

const httpServer = createServer(app);
io.attach(httpServer);

Не следует без необходимости менять порядок создания HTTP server / Express / Socket.IO.

Это было сделано для предотвращения двойной регистрации request listeners и ошибки:

ERR_HTTP_HEADERS_SENT
10. Room Registry

Файл:

backend/src/rooms.ts

Registry является in-memory хранилищем состояния комнат.

Тип:

RoomStatus = 'active' | 'grace' | 'ending' | 'ended'

Room содержит:

roomId
hostToken
hostIdentity
createdAt
status
graceEndsAt
memberTokens
activeSharerId

Registry отвечает за:

create room;
get room;
verify host token;
host identity;
room status;
grace state;
member tokens;
screen sharing state.

Все данные находятся в памяти процесса Node.js.

Следствие:

после restart backend:

rooms = empty

Старые комнаты становятся недоступными на уровне control plane.

Это осознанное MVP-решение.

11. Room creation

Endpoint:

POST /rooms

Backend:

registry.create()
      │
      ▼
Room created
      │
      ▼
LiveKit room created
      │
      ▼
roomId + hostToken

Ответ:

{
  "roomId": "...",
  "hostToken": "..."
}

roomId предназначен для пользователя.

hostToken является секретом host.

12. Participant join

Endpoint:

POST /rooms/:roomId/join

Body:

{
  "name": "User"
}

или для host:

{
  "name": "User",
  "hostToken": "..."
}

Алгоритм:

request
  │
  ▼
room exists?
  │
  ▼
room ended?
  │
  ▼
hostToken provided?
  │
  ├── yes → verify host token → host
  │
  └── no  → guest
  │
  ▼
check participant count
  │
  ▼
generate identity
  │
  ▼
mint LiveKit access token
  │
  ▼
record member token
  │
  ▼
return join data

Ответ содержит:

accessToken
livekitUrl
role
identity
displayName
roomId
memberToken
13. Participant identity

Каждому участнику backend генерирует отдельный identity.

Identity используется для:

LiveKit participant identity;
определения host;
screen sharing state;
удаления participant;
member token association.

Host определяется не по имени пользователя, а по:

room.hostIdentity
14. Host token

При создании комнаты генерируется:

hostToken

Требование:

128-bit entropy

Генерация:

randomBytes(16).toString('base64url')

Host token позволяет:

войти как host;
завершить комнату;
удалить участника.

Невалидный host token намеренно обрабатывается как NOT_FOUND, а не как отдельная ошибка авторизации.

15. Member token

Для каждого участника создаётся:

memberToken

Он связан с:

identity → token

Используется для доступа к attachment API.

При удалении участника:

registry.revokeMemberToken()

вызывается сразу.

Это означает, что attachment access должен прекращаться независимо от последующего LiveKit disconnect.

16. Participant limit

Константа:

MAX_PARTICIPANTS = 4

Максимум:

4 participants

Во время grace host занимает зарезервированный слот.

Поэтому guest capacity вычисляется как:

maxParticipants - 1

если host находится в grace.

17. Room lifecycle

Основные состояния:

active
   │
   │ host disconnect
   ▼
grace
   │
   ├── host reconnect
   │       │
   │       ▼
   │     active
   │
   └── timeout
           │
           ▼
         ended

Также используется промежуточное состояние:

ending

Оно нужно для намеренного завершения комнаты host'ом.

18. Grace period

Файл:

backend/src/grace.ts

Grace service управляет временным состоянием после ухода host.

Default:

GRACE_TIMEOUT_SECONDS = 60

При старте:

active
  ↓
grace

Backend:

записывает graceEndsAt;
отправляет countdown;
запускает timer;
ожидает возвращения host.

Каждую секунду вычисляется:

secondsLeft

и отправляется через Socket.IO.

Если host возвращается:

cancelGrace()

и:

grace
 ↓
active

Если timeout истекает:

grace
 ↓
ended

после чего LiveKit room удаляется.

19. LiveKit webhooks

Файл:

backend/src/webhooks.ts

Backend принимает webhook от LiveKit.

Webhook signature проверяется через:

WebhookReceiver

Основные события:

participant_left
room_finished
participant_left

Backend:

получает roomId;
получает participant identity;
находит room;
проверяет screen sharer;
проверяет host identity;
если ушёл host — запускает grace.
room_finished

Если room всё ещё active:

room_finished
    ↓
startGrace()
20. Intentional room ending

Endpoint:

POST /rooms/:roomId/end

Только host.

Перед удалением LiveKit room:

room.status = ending

Это важно.

Причина:

LiveKit может отправить webhook во время teardown.

Если room уже помечена:

ending

webhook не должен запускать новый grace period.

После удаления:

registry.markEnded()

Итог:

ending
  ↓
ended
21. Removing participant

Endpoint:

POST /rooms/:roomId/remove

Только host.

Алгоритм:

verify host token
       ↓
emit participant removed
       ↓
revoke member token
       ↓
LiveKit removeParticipant

Событие Socket.IO отправляется до удаления, чтобы клиент успел получить причину disconnect.

22. Screen sharing

Registry хранит:

activeSharerId

В одной комнате разрешён только один screen sharer.

Методы:

claimShare()
releaseShare()
clearShare()
getActiveSharer()

Если другой participant уже демонстрирует экран:

BUSY

Если sharer отключается:

participant_left
      ↓
clearShare()
      ↓
broadcastShareState(null)
23. Chat

Файл:

backend/src/chat.ts

Chat использует Socket.IO.

Backend хранит chat state для комнаты.

Chat НЕ является частью LiveKit media layer.

При завершении комнаты:

chat.clear(roomId)

При завершении grace:

chat.clear(roomId)
24. Attachments

Файл:

backend/src/attachments.ts

Файлы загружаются через backend API.

Авторизация:

x-member-token

или token query parameter для download.

Member token должен соответствовать участнику комнаты.

Ограничения:

MAX_ATTACHMENT_BYTES = 10 MB
MAX_ATTACHMENTS_PER_MESSAGE = 5

Backend проверяет:

member token;
тип файла;
размер;
количество attachments.

Storage:

ATTACHMENT_STORAGE_PATH

В production используется persistent storage, если он настроен на Render.

25. Frontend API client

Файл:

frontend/src/shared/lib/apiClient.ts

Все backend endpoint URLs централизованы здесь.

Основные функции:

createRoom()
getRoomStatus()
joinRoom()
endCall()
removeParticipant()
uploadAttachment()
attachmentDownloadUrl()

Base URL:

VITE_API_BASE_URL

URL строятся через:

url-join

Room ID encode'ится через:

encodeURIComponent()
26. Frontend validation

Для security-critical join response используется Zod:

joinResponseSchema

Проверяются:

accessToken
livekitUrl
role
identity
displayName
roomId
memberToken

Некритичные response body намеренно не валидируются через Zod.

Это сделано как осознанное архитектурное правило проекта:

Runtime validation используется там, где некорректный backend response может привести к небезопасному или трудно диагностируемому поведению.

Не следует механически добавлять Zod schemas ко всем endpoint responses без причины.

27. LiveKit integration

Backend использует:

livekit-server-sdk

Основные backend responsibilities:

create room
delete room
remove participant
list participant count
mint access tokens
verify webhooks

Frontend использует LiveKit Components React SDK.

Media flow:

Participant A ─┐
               │
Participant B ─┼──> LiveKit Cloud SFU
               │
Participant C ─┤
               │
Participant D ─┘

Backend не является media proxy.

28. Docker
Backend production

Файл:

backend/Dockerfile

Multi-stage build:

node:22-alpine
     │
     ├── npm ci
     ├── TypeScript build
     │
     ▼
runtime image
     │
     ├── npm ci --omit=dev
     ├── copy dist
     └── node dist/server.js

Runtime запускается от:

node

пользователя.

29. Frontend production Dockerfile

Файл:

frontend/Dockerfile

Build stage:

Node
 ↓
npm ci
 ↓
npm run build

Runtime stage:

nginx:alpine
 ↓
serve /dist

VITE_API_BASE_URL передаётся как Docker build argument.

30. Frontend routing

Frontend является SPA.

Nginx должен использовать fallback:

try_files $uri $uri/ /index.html;

Это необходимо для маршрутов React, например:

/r/:roomId

Если production hosting настроен неправильно и используется redirect вместо rewrite, прямое открытие SPA route может ломаться.

Текущая production deployment использует Render Static Site, поэтому routing configuration Render также важна.

31. Important production lesson

Одна из уже найденных production проблем была связана с настройкой Render routing.

Проблема была не в React Router и не в backend.

На Render был настроен неправильный тип правила:

redirect

вместо необходимого:

rewrite

Для SPA fallback должен использоваться rewrite на:

/index.html

а не HTTP redirect.

При дальнейшей диагностике проблем с прямым открытием /room/... необходимо сначала проверить routing/rewrite configuration Render.

32. Important architecture distinction

Не путать:

LiveKit URL

и:

LiveKit Host

LIVEKIT_URL:

browser → LiveKit

обычно:

wss://...

LIVEKIT_HOST:

backend → LiveKit Admin API

обычно:

https://...
33. Current production infrastructure

Current:

GitHub
  ↓
Render
  ├── frontend
  └── backend
        ↓
    LiveKit Cloud

Old infrastructure:

GitLab CI
  ↓
demo server
  ↓
Docker Compose
  ↓
Traefik
  ↓
self-hosted LiveKit

Old infrastructure is not the current production architecture.

34. Important files

При debugging в первую очередь смотреть:

Room/lifecycle
backend/src/rooms.ts
backend/src/grace.ts
backend/src/webhooks.ts
backend/src/routes/rooms/controller.ts
backend/src/routes/rooms/router.ts
LiveKit
backend/src/livekitAdmin.ts
backend/src/livekitTokens.ts
backend/src/webhooks.ts
Server
backend/src/server.ts
backend/src/app.ts
backend/src/config.ts
Realtime
backend/src/socket.ts
backend/src/chat.ts
Attachments
backend/src/attachments.ts
Frontend API
frontend/src/shared/lib/apiClient.ts
Deployment

Current:

Render
Dockerfile
frontend/Dockerfile
backend/Dockerfile

Legacy:

gitlab-ci.yml
docker-compose.develop.yml
deploy/livekit.Dockerfile
deploy/livekit.yaml
35. Current backend API
POST /rooms
GET  /rooms/:roomId
POST /rooms/:roomId/join
POST /rooms/:roomId/end
POST /rooms/:roomId/remove

Attachments имеют отдельный route under room:

POST /rooms/:roomId/attachments

Webhook endpoint используется LiveKit.

36. Error semantics

Основные room errors включают:

NOT_FOUND
ENDED
FULL
INTERNAL

Invalid host token intentionally maps to:

NOT_FOUND

Это скрывает существование комнаты от обладателя неправильного host token.

37. Important constraints

Не добавлять без необходимости:

PostgreSQL;
Redis;
message broker;
Kubernetes;
GitHub Actions;
отдельный signaling server;
self-hosted LiveKit;
TURN infrastructure;
дополнительный backend service.

Для текущего MVP это лишняя сложность.

Если задача действительно требует persistent state, horizontal scaling или multi-instance backend, сначала объяснить, почему текущий in-memory registry перестаёт быть достаточным.

38. Known trade-offs
In-memory room registry

Плюсы:

простой;
быстрый;
нет БД;
легко тестировать;
подходит для MVP.

Минусы:

state теряется после restart;
несколько backend instances не могут надёжно разделять room state;
Render restart может привести к потере активных комнат.
LiveKit Cloud

Плюсы:

не нужно самостоятельно обслуживать SFU;
не нужно настраивать UDP/TURN;
проще production deployment;
меньше инфраструктурного кода.
Render

Плюсы:

GitHub integration;
automatic deployment;
не нужен отдельный GitLab CI/CD;
frontend/backend можно деплоить независимо.
39. Development scripts

Backend:

npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
npm run test

Frontend использует аналогичные стандартные scripts проекта.

40. Rules for AI working with this project

Перед изменением кода:

Определи, к какому слою относится задача:
frontend;
backend;
LiveKit;
realtime;
deployment.
Найди существующий source of truth.
Не дублируй существующую логику.
Не меняй API contract без необходимости.
Не заменяй LiveKit Cloud self-hosted infrastructure.
Не добавляй GitHub Actions только ради CI/CD.
Не добавляй БД для room state без явной необходимости.
Сохраняй существующее разделение:
Frontend
   ↓
Backend control plane
   ↓
LiveKit Cloud media plane
При lifecycle bugs сначала проверяй:
Room Registry
→ LiveKit webhook
→ Grace Service
→ Socket.IO events
→ Frontend room state
При production routing bugs сначала проверяй:
Render routing
→ frontend SPA fallback
→ VITE_API_BASE_URL
→ CORS
→ backend
При LiveKit connection bugs разделяй:
Browser → LiveKit Cloud

и:

Backend → LiveKit Cloud Admin API

Это разные соединения и используют разные environment variables.

41. Current mental model

Самая важная модель проекта:

                    CONTROL PLANE
                         │
                         ▼
Browser ────────────> Backend
   │                    │
   │                    ├── Room Registry
   │                    ├── Host/Guest auth
   │                    ├── Tokens
   │                    ├── Grace
   │                    ├── Chat
   │                    ├── Attachments
   │                    └── Webhooks
   │
   │
   └──────────────────────────────┐
                                  │
                                  ▼
                           LiveKit Cloud
                                  │
                                  ▼
                             MEDIA PLANE

Backend принимает решения о состоянии приложения.

LiveKit принимает решения о media connections.

Frontend отображает состояние и взаимодействует с обеими системами.

Это главное архитектурное разделение проекта.


### Как я бы использовал этот файл

Я бы **не пихал его в README**. Лучше:

```text
VibeCall/
├── README.md
├── PROJECT_CONTEXT.md   ← этот документ
├── backend/
├── frontend/
├── docs/
└── ...