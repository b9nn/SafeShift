# NLP Module Analysis & Incomplete Functionality

## 📝 NLP Module (`src/nlp.py`) - Understanding

### What It Does

**Verbal Abuse Detection for Opt-In Worker Reports**

The NLP module uses a pre-trained **toxic-bert model** (unitary/toxic-bert from HuggingFace) to detect verbal abuse in transcribed workplace audio/text.

### Key Features

1. **Toxicity Classification**
   - Classifies text into 6 categories:
     - `toxic` - General toxic language
     - `severe_toxic` - Severe toxic content
     - `obscene` - Obscene language
     - `threat` - Threatening language
     - `insult` - Insulting language
     - `identity_hate` - Identity-based hate speech

2. **Scoring System**
   - Each category gets a score (0.0-1.0)
   - Threshold: 0.25 (scores above this are flagged)
   - Returns: `is_abusive`, `severity`, `flagged_categories`, `scores`

3. **Batch Processing**
   - Can analyze single text or batch of texts
   - Provides summary statistics (abuse rate, category breakdown)

### How It's Used

**Opt-In Worker Reporting (Not Passive Surveillance):**
- Workers voluntarily submit voice reports via Arduino microphone
- Audio is transcribed externally (not by SafeShift)
- Transcribed text is sent to `/api/report-abuse` endpoint
- NLP module analyzes text for verbal abuse
- Results stored in Snowflake (metadata only, no text stored)

### Integration Status

✅ **Fully Integrated:**
- `src/nlp.py` - NLP module implementation
- `src/api.py` - FastAPI endpoint `/analyze-text`
- `server/index.js` - Express endpoint `/api/report-abuse`
- `server/snowflake.js` - Stores abuse report metadata

**Flow:**
```
Worker submits text → POST /api/report-abuse → Calls ML API /analyze-text → 
NLP analyzes → Returns results → Stored in Snowflake GOVERNANCE.ABUSE_REPORTS
```

---

## ❌ Incomplete Functionality

Based on original idea (`docs/idea.md`) and current codebase analysis:


### 2. **Certifications System**

**What's Missing:**
- Automatic certification generation when compliance score ≥ 95
- Certification display in frontend
- Certification verification system
- Certification history tracking

**Current Status:**
- ✅ Snowflake SQL has certification logic (score ≥ 95 = CERTIFICATION)
- ❌ No frontend display
- ❌ No certification generation/issuance
- ❌ No certification API endpoints

**What Needs to Be Done:**
- Create certification generation endpoint
- Display certifications in company dashboard
- Store certifications in database
- Add certification verification

---

### 3. **Insurance Discounts** ⭐ (Marked as ATTRACTIVE in Idea)

**What's Missing:**
- Insurance discount calculation
- Insurance discount display
- Integration with insurance providers
- Discount eligibility tracking

**Current Status:**
- ✅ Snowflake SQL has insurance discount logic (score ≥ 85 = INSURANCE_DISCOUNT)
- ❌ No frontend display
- ❌ No discount calculation/application
- ❌ No insurance provider integration

**What Needs to Be Done:**
- Calculate discount percentages based on compliance scores
- Display discount eligibility in dashboard
- Create API for insurance providers to query discounts
- Track discount history

---

### 4. **Company Rating Database**

**What's Missing:**
- Public rating system for all companies
- Rating calculation based on compliance history
- Rating display/search functionality
- Rating API for external access

**Current Status:**
- ❌ No rating system implemented
- ✅ Snowflake has compliance scores but no public rating
- ❌ No rating database/API

**What Needs to Be Done:**
- Create rating calculation algorithm
- Build rating database/API
- Add rating display in frontend
- Create public rating search

---

### 5. **Frontend-Backend API Integration**

**What's Missing:**
- Frontend uses localStorage instead of backend API
- Company data not synced with backend
- Real-time updates not connected
- SafetyMonitor uses simulated data

**Current Status:**
- ✅ Backend has all APIs (`/api/companies`, `/api/sensor-data`, etc.)
- ❌ Frontend doesn't call backend APIs
- ❌ Frontend uses localStorage only
- ❌ No real-time data connection

**What Needs to Be Done:**
- Create `src/services/apiService.ts` to call backend
- Update CompanyService to use API
- Connect SafetyMonitor to real sensor data
- Add WebSocket for real-time updates

---

### 6. **Speech-to-Text Integration**

**What's Missing:**
- Audio transcription service
- Arduino microphone → transcription pipeline
- Integration with NLP module

**Current Status:**
- ✅ NLP module ready (`src/nlp.py`)
- ✅ Backend endpoint ready (`/api/report-abuse`)
- ❌ No speech-to-text service
- ❌ No audio → text pipeline

**What Needs to Be Done:**
- Integrate speech-to-text API (Google Cloud, AWS Transcribe, etc.)
- Create Arduino → audio → transcription → NLP pipeline
- Handle audio file uploads

---

### 7. **Multi-Reward Types**

**What's Missing:**
- Certifications as rewards
- Insurance discounts as rewards
- Preferred supplier status
- Token-based rewards (SPL tokens)

**Current Status:**
- ✅ Only SOL rewards implemented
- ✅ Snowflake has reward_type field (CERTIFICATION, INSURANCE_DISCOUNT, etc.)
- ❌ No actual certification/insurance reward logic
- ❌ No SPL token rewards

**What Needs to Be Done:**
- Implement certification issuance
- Implement insurance discount application
- Add SPL token reward support
- Create reward type selection logic

---

### 8. **Governance Dashboard (Blackboard.io)**

**What's Missing:**
- Governance interface for regulators/NGOs
- Historical trend visualization
- Audit log interface
- Compliance report generation

**Current Status:**
- ✅ Snowflake has governance tables
- ✅ Data is stored
- ❌ No governance dashboard
- ❌ No visualization interface

**What Needs to Be Done:**
- Create governance dashboard
- Add historical trend charts
- Build audit log viewer
- Generate compliance reports

---

## 📊 Summary Table

| Feature | Status | Priority | Location |
|---------|--------|----------|----------|
| **NLP Verbal Abuse Detection** | ✅ Complete | High | `src/nlp.py`, `src/api.py`, `server/index.js` |
| **Certifications** | ⚠️ Partial | High | SQL only, no frontend/API |
| **Insurance Discounts** | ⚠️ Partial | ⭐ High | SQL only, no frontend/API |
| **Company Rating DB** | ❌ Missing | Medium | Not implemented |
| **Frontend-Backend API** | ❌ Missing | High | Frontend uses localStorage |
| **Speech-to-Text** | ❌ Missing | Medium | NLP ready, no transcription |
| **Multi-Reward Types** | ⚠️ Partial | Medium | SOL only, others in SQL |
| **Governance Dashboard** | ❌ Missing | Medium | Data exists, no UI |

---

## 🎯 Recommended Implementation Order

1. **Frontend-Backend API Integration** (Critical - enables real data)
2. **Certifications System** (High value, partially done)
4. **Insurance Discounts** (Marked as attractive)
5. **Company Rating Database** (Medium priority)
6. **Speech-to-Text** (Medium priority)
7. **Multi-Reward Types** (Enhancement)
8. **Governance Dashboard** (Nice to have)

---

## ✅ What's Complete

- ✅ NLP module (`src/nlp.py`)
- ✅ NLP API endpoint (`/analyze-text`)
- ✅ Abuse report endpoint (`/api/report-abuse`)
- ✅ Snowflake integration for abuse reports
- ✅ Environmental sensor monitoring
- ✅ ML risk scoring
- ✅ Solana reward distribution
- ✅ Session analysis with Cortex AI
- ✅ Company registration
- ✅ Automated rewards

---

**NLP is fully implemented and integrated. The main gaps are certifications/insurance discounts (partially done) and frontend-backend API connection.**
