---
sidebar_position: 1
---

# API Endpoints

Revelio's backend exposes a REST API for all operations. This is primarily used by the frontend but can be accessed directly for automation or integration.

## Base URL

```
http://localhost:8000
```

The port may vary based on configuration (see `REVELIO_PORT` environment variable).

## Health Check

### GET /

Check if the API is running.

**Response:**
```json
{
  "status": "ok",
  "service": "Revelio API"
}
```

## Story Generation

### POST /plan_story

Research a topic and create a story plan.

**Request Body:**
```json
{
  "topic": "string",
  "num_slides": 5,
  "aesthetic": "optional style description",
  "image_size": "story"  // or "square"
}
```

**Response:**
```json
{
  "plan": {
    "topic": "string",
    "slides": [...],
    "aesthetic": {...},
    "research": {...},
    "image_size": "story"
  }
}
```

### POST /plan_from_text

Create a plan from user-provided text (no research).

**Request Body:**
```json
{
  "text": "Your content here...",
  "topic": "Custom Content",
  "num_slides": 5,
  "aesthetic": "",
  "image_size": "story"
}
```

### POST /generate_from_plan

Generate images from an approved plan.

**Request Body:**
```json
{
  "plan": { /* plan object from /plan_story */ },
  "provider": "gemini-flash"  // or "gemini-pro", "fal"
}
```

**Response:**
```json
{
  "images": [
    "http://localhost:8000/images/folder/01.png",
    "http://localhost:8000/images/folder/02.png"
  ]
}
```

## Trending & RSS

### GET /trending_topics

Get trending topic suggestions.

**Query Parameters:**
- `categories`: Comma-separated list (tech, ai, india, world, politics, sports, movies, business, finance, science)

**Example:**
```
GET /trending_topics?categories=tech,ai
```

### GET /rss_topics

Get news topics from RSS feeds.

**Query Parameters:**
- `category`: Optional (tech, world, india, business, science)

## Styles

### GET /styles

Get all available styles.

**Response:**
```json
{
  "predefined": [
    {
      "id": "cinematic",
      "name": "Cinematic",
      "art_style": "...",
      "color_palette": "...",
      ...
    }
  ],
  "custom": [...]
}
```

### POST /styles

Save a custom style.

**Request Body:**
```json
{
  "name": "My Style",
  "art_style": "...",
  "color_palette": "...",
  "lighting": "...",
  "texture": "...",
  "typography_style": "...",
  "background_style": "..."
}
```

### DELETE /styles/{style_id}

Delete a custom style.

### POST /extract_style

Extract style from a reference image.

**Request:** Multipart form data with:
- `file`: Image file (JPEG, PNG, WebP, GIF)
- `name`: Optional style name

## Brand Configuration

### GET /brand

Get current brand configuration.

**Response:**
```json
{
  "enabled": true,
  "type": "logo",
  "position": "bottom-right",
  "opacity": 0.7,
  "padding": 20
}
```

### POST /brand

Update brand configuration.

**Request Body:**
```json
{
  "enabled": true,
  "type": "text",
  "text": "@username",
  "fontSize": 24,
  "fontColor": "#FFFFFF",
  "position": "bottom-right",
  "opacity": 0.7,
  "padding": 20
}
```

**Valid Positions:** `top-left`, `top-right`, `bottom-left`, `bottom-right`

## Boards (Saved Content)

### GET /boards/{board_type}

Get saved boards.

**Path Parameters:**
- `board_type`: `research` or `images`

### POST /boards/{board_type}

Save a new board.

**Request Body:**
```json
{
  "id": "unique-id",
  "name": "Board Name",
  "data": { /* board-specific data */ }
}
```

### DELETE /boards/{board_type}/{board_id}

Delete a board.

## Error Responses

All endpoints may return:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400`: Bad request (invalid parameters)
- `404`: Resource not found
- `500`: Server error (check backend logs)

## Rate Limits

The API itself has no rate limits. However, underlying AI services (Google, Tavily, FAL) have their own limits based on your API key tier.

## Static Files

Generated images are served at:
```
GET /images/{folder_name}/{filename}
```
