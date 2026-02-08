# NLP Frontend Integration

## Overview

The NLP (Natural Language Processing) verbal abuse detection system is now fully integrated with the frontend, displaying real-time warnings when abusive language is detected in worker voice reports.

## How It Works

### 1. Worker Submits Voice Report
- Workers can opt-in to submit voice reports via the Arduino device
- Audio is transcribed externally (not by SafeShift)
- Transcribed text is sent to the backend API

### 2. Backend NLP Analysis
- **Endpoint**: `POST /api/report-abuse`
- Calls FastAPI ML service (`/analyze-text`) which uses the `toxic-bert` model
- Analyzes text for 6 categories:
  - `toxic` - Generally toxic language
  - `severe_toxic` - Extremely toxic language
  - `obscene` - Profane/vulgar language
  - `threat` - Threatening language
  - `insult` - Insulting/demeaning language
  - `identity_hate` - Discriminatory language

### 3. Warning Generation
- If `is_abusive === true`, a warning is created with:
  - **Type**: `nlp_abuse`
  - **Severity**: `high` (if severity > 0.5) or `medium` (otherwise)
  - **Message**: Lists flagged categories
  - **Categories**: Array of detected abuse types
  - **Timestamp**: When the report was analyzed

### 4. Data Storage
- **Privacy by design**: Original text is NOT stored
- Only metadata is stored in Snowflake `GOVERNANCE.ABUSE_REPORTS`:
  - Factory ID
  - Worker ID (optional, can be anonymous)
  - `is_abusive` boolean
  - `severity` float (0-1)
  - `flagged_categories` (comma-separated string)

### 5. Frontend Display
- **Component**: `NLPWarnings.tsx`
- **Location**: Dashboard (full-width section below safety metrics)
- **Endpoint**: `GET /api/nlp-warnings/:companyId?limit=10`
- **Features**:
  - Displays recent abuse warnings for selected company
  - Auto-refreshes every 30 seconds
  - Shows severity badges (High/Medium)
  - Displays flagged categories with icons
  - Shows relative timestamps ("Just now", "5m ago", etc.)
  - Empty state when no abuse detected

## API Endpoints

### POST /api/report-abuse
**Request:**
```json
{
  "text": "transcribed text from worker voice report",
  "companyId": "company-001",
  "factoryId": "factory-001",  // optional
  "workerId": "worker-123"     // optional, can be anonymous
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "is_abusive": true,
    "severity": "0.75",
    "flagged_categories": ["toxic", "threat"],
    "scores": {
      "toxic": 0.85,
      "threat": 0.72,
      "obscene": 0.12,
      ...
    }
  },
  "warning": {
    "type": "nlp_abuse",
    "severity": "high",
    "message": "Verbal abuse detected: toxic, threat",
    "categories": ["toxic", "threat"],
    "timestamp": 1234567890
  }
}
```

### GET /api/nlp-warnings/:companyId
**Query Parameters:**
- `limit` (optional, default: 10) - Number of warnings to return

**Response:**
```json
{
  "success": true,
  "companyId": "company-001",
  "warnings": [
    {
      "timestamp": 1234567890,
      "severity": "high",
      "categories": ["toxic", "threat"],
      "message": "Verbal abuse detected: toxic, threat"
    },
    ...
  ],
  "count": 2
}
```

## Frontend Component

### NLPWarnings Component
- **File**: `src/components/NLPWarnings.tsx`
- **Props**: `company: Company`
- **Styling**: `src/components/NLPWarnings.css`

**Features:**
- Real-time warning display
- Severity-based color coding (red for high, orange for medium)
- Category icons and tags
- Relative timestamps
- Empty state with success message
- Error handling with retry button
- Auto-refresh every 30 seconds

## Integration Points

1. **Dashboard**: `src/components/Dashboard.tsx`
   - Renders `NLPWarnings` component in full-width section
   - Displays warnings for the currently selected company

2. **Backend**: `server/index.js`
   - `/api/report-abuse` endpoint processes text reports
   - `/api/nlp-warnings/:companyId` endpoint fetches recent warnings

3. **Snowflake**: `server/snowflake.js`
   - `insertAbuseReport()` stores warning metadata
   - `getNLPWarnings()` retrieves recent warnings for a company

4. **ML API**: `src/api.py` (FastAPI)
   - `/analyze-text` endpoint uses `src/nlp.py` (toxic-bert model)

## Privacy & Security

- ✅ **No text storage**: Original transcribed text is never stored
- ✅ **Opt-in only**: Workers must voluntarily submit reports
- ✅ **Metadata only**: Only analysis results are stored
- ✅ **Anonymous option**: Worker ID can be omitted
- ✅ **Secure API**: All endpoints require proper authentication (if implemented)

## Future Enhancements

- Real-time WebSocket updates for instant warning display
- Historical trend visualization
- Category-based filtering
- Export functionality for compliance reports
- Integration with reward system (penalties for repeated abuse)
