# AstroSite 🦞

Астрологическое приложение для расчёта натальных карт и транзитов планет, построенное на базе C-библиотеки [Sweph](https://www.astronomy.swin.edu.au/sweph/) с использованием Go и PocketBase.

## Особенности

- 🔮 **Расчёт натальных карт** — построение астрологических карт для любой даты, времени и места рождения
- 🌙 **Транзиты планет** — анализ текущего положения планет относительно натальной карты
- 📐 **Поддержка домов** — различные системы расчёта домов (Placidus, Koch и др.)
- ⚙️ **Пользовательские настройки** — гибкая конфигурация аспектов, орбисов, времени суток
- 🔐 **Авторизация через Telegram** — простая интеграция с ботом Telegram для входа в систему
- 🗄️ **PocketBase** — встроенная база данных и REST API без лишней инфраструктуры

## Технологический стек

| Компонент | Описание |
|-----------|----------|
| **Go 1.26.4** | Ядро приложения |
| **Sweph C library** | Астрономические расчёты через CGO |
| **PocketBase** | Бэкенд, база данных и API |
| **CGO** | Связь Go с C-библиотекой Sweph |

## Структура проекта

```
astro-site/
├── cmd/astro-site/          # Точка входа в приложение
│   └── main.go              # Основной файл с маршрутизацией API
├── internal/
│   ├── astrology/           # Астрологическая логика (расчёты)
│   │   └── processor.go     # Интеграция Sweph через CGO
│   └── auth/                # Логика аутентификации Telegram
├── include/                 # C-заголовки для CGO
├── lib/                     # Скомпилированная библиотека Sweph
├── ephe/                    # Папка с эфемеридами (Swiss Ephemeris data)
├── migrations/              # Миграции базы данных PocketBase
├── pb_data/                 # Данные PocketBase (dev-режим)
└── memory/                  # Папка для заметок и дневников (picoclaw integration)
```

## Основные API эндпоинты

### 1. Авторизация Telegram
```http
POST /api/auth/telegram
Content-Type: application/json

{
  "id": "987654321",
  "first_name": "Иван"
}
```

### 2. Получение настроек пользователя
```http
GET /api/astrology/settings
Authorization: Bearer <token>
```

### 3. Сохранение настроек
```http
POST /api/astrology/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "planets": ["0", "1", "2"],
  "aspects": ["90", "180"],
  "transit_orb": "1",
  "houses": "P"
}
```

### 4. Расчёт натальной карты
```http
GET /api/astrology/chart?date=2000-06-15T12:30:00&lat=51.73&lon=55.10&title=Natal
Authorization: Bearer <token>
```

### 5. Расчёт транзитов (на текущий момент)
```http
GET /api/astrology/transit
Authorization: Bearer <token>
```
*Примечание: сначала рассчитайте натальную карту, чтобы получить базу для сравнения*

## Структура данных

### Натальная карта (`AstroResult`)
```json
{
  "type": "natal",
  "ts": "2024-01-15T18:30:00Z",
  "pl": [
    {
      "id": 0,
      "lon": 195.42,
      "lat": -1.23,
      "sp": 0.0,
      "h": 10,
      "ir": false
    }
  ],
  "hs": [6.48, 7.12, 8.35, ...],
  "as": [
    {
      "a": 0,
      "b": 72,
      "t": 90,
      "orb": 0.12
    }
  ]
}
```

### Транзиты (`TransitResult`)
```json
{
  "ts": "2026-06-30T08:25:00Z",
  "pl": [
    {
      "id": 1,
      "lon": 245.17,
      "lat": 0.45,
      "sp": -0.05,
      "ir": true
    }
  ],
  "as": [
    {
      "a": 0,
      "b": 1,
      "t": 90,
      "orb": 0.87
    }
  ]
}
```
## Установка и запуск

### Требования
- Go 1.26.x
- C-библиотека Sweph с эфемеридами (см. папку `ephe/`)

### Сборка
```bash
cd astro-site
go build -o astro-site ./cmd/astro-site/
```

### Запуск сервера
```bash
./astro-site serve
# или
./astro-site serve --http=0.0.0.0:8090
```

## Настройки пользователя

### Поля `UserSettings`:
- **planets** — список ID планет для отображения (по умолчанию все)
- **aspects** — типы аспектов для расчёта (0=конъюнкция, 72=квадрат, 90=квадрат, 120=секстиль, 180=оппозиция)
- **transit_orb** — лимит орбиса для транзитов (по умолчанию 1.0°)
- **houses** — система домов: `P`=Placidus, `K`=Koch и др.
- **rotate** — вращение домов
- **direction** — направление домов: `clockwise` или `counter-clockwise`
- **tz/locale/city** — временная зона и локаль
- **latitude/longitude** — координаты места рождения
- **natal_orb** — индивидуальные орбисы для каждой планеты в натальной карте

## Астрономические расчёты

Расчёты выполняются через CGO с использованием библиотеки Sweph:

```go
// Вспомогательные функции на C (в include/swephexp.h):
- swe_set_ephe_path() — установка пути к эфемеридам
- swe_calc_ut() — расчёт позиции планеты по UTC
- swe_houses() — расчёт домов
- swe_house_pos() — определение номера дома
```
# Astro3D.ru Frontend Project

## Overview
This project is the frontend for the Astro3D.ru website, providing a web interface for astrological calculations, specifically focused on natal charts (radixes) and planetary transits. It allows users to interact with astronomical data, manage personal records, and receive AI-driven interpretations.

## Key Features

### 1. Authentication
*   **Provider**: Telegram Login Widget (`astro3dAI_bot`).
*   **Mechanism**: Users authenticate via Telegram; the system stores a session token in `localStorage` for subsequent API requests.

### 2. User Profile & Settings
*   **Default Parameters**: Users can save and load personal settings:
    *   City, Latitude, Longitude, and Timezone.
    *   House System (Placidus, Koch, Equal).
    *   Custom JSON parameters for advanced engine configuration.

### 3. Horoscope Database (Collections)
*   **Management**: Users can maintain a private archive of their charts.
*   **Functionality**:
    *   List records filtered by user ID.
    *   Select a specific natal chart from the list to use as a base for transit calculations.
    *   Delete unnecessary records from the database.

### 4. Astrological Calculations
*   **Natal Chart (Radix)**: Calculate a birth/event chart based on date, time, and geographic coordinates. Returns unique IDs for each calculation.
*   **Transit Calculation**: Generate current planetary transits. Can be linked to a specific natal chart ID to see how planets move relative to the user's houses.

### 5. AI Interpretation (Astropsychologist)
The system provides three distinct modes of analysis powered by an AI model:
1.  **Natal Analysis**: A detailed breakdown of the birth chart.
2.  **Current Sky Situation**: An interpretation of current planetary transits.
3.  **Combined Analysis**: Synthesis of transits within the specific houses of the user's natal chart.

## Technical Stack & Structure
*   **Frontend**: Vanilla JavaScript, HTML5, CSS3.
*   **API Interaction**: Centralized via `ApiService` in `api.js`.
*   **Data Flow**:
    *   `index.html`: UI structure and buttons.
    *   `styles.css`: Card-based layout and styling.
    *   `app.js` / `ui.js`: Logic for handling user interactions and updating the DOM.
    *   `api.js`: Fetch requests to backend endpoints (auth, settings, collections, astrology, interpret).

## API Endpoints Summary
*   `POST /api/auth/telegram`: User login.
*   `GET/POST /api/astrology/settings`: Manage user preferences.
*   `GET/DELETE /api/collections/horoscopes/records`: Manage the chart database.
*   `GET /api/astrology/chart`: Generate natal charts.
*   `GET /api/astrology/transit`: Generate transit data.
*   `POST /api/astrology/interpret`: Get AI-generated analysis (types: natal, transit, full).
## Лицензия

MIT License — свободное использование, модификация и распространение.
