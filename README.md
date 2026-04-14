# NovaMind AI Marketing Content Pipeline

![React](https://img.shields.io/badge/React-18-blue) ![Claude](https://img.shields.io/badge/Claude-Sonnet%204-orange) ![HubSpot](https://img.shields.io/badge/HubSpot-CRM%20API-red) ![Storage](https://img.shields.io/badge/Storage-window.storage-green)

An AI-powered, end-to-end marketing automation pipeline that takes a blog topic through content generation, persona-targeted newsletter creation, CRM distribution, performance analysis, and content optimization — built as a single React JSX artifact using the Anthropic Claude API.

---

## Table of Contents

- [Overview](#overview)
- [Architecture & Flow](#architecture--flow)
- [Tools & Technologies](#tools--technologies)
- [AI Integration Details](#ai-integration-details)
- [HubSpot CRM Integration](#hubspot-crm-integration)
- [Performance Analytics](#performance-analytics)
- [Assumptions & Known Limitations](#assumptions--known-limitations)
- [Bonus Features](#bonus-features)
- [Running Locally](#running-locally)
- [Production Roadmap](#production-roadmap)

---

## Overview

NovaMind is a fictional early-stage AI startup that helps small creative agencies automate their daily workflows. This pipeline is a fully working, end-to-end AI-powered marketing automation system built as a portfolio project.

The system allows a content operator to:

1. Enter a weekly blog topic and generate a full blog post draft plus three persona-targeted newsletter versions using Claude AI
2. Review and edit all generated content, generate copy variants, and revise copy with directional feedback
3. Simulate a five-phase HubSpot CRM distribution flow with realistic API payloads and responses
4. Analyze campaign performance with AI-powered insights and get next-topic suggestions based on engagement trends

---

## Architecture & Flow

### Pipeline Stages

| Stage | Name | Description |
|-------|------|-------------|
| 0 | Dashboard | Campaign history, KPIs, pipeline status, quick launch |
| 1 | Generate | AI blog post + 3 persona newsletters via Claude API |
| 2 | Review | Edit content, generate variants, revise with feedback, optimize headlines |
| 3 | Distribute | 5-phase HubSpot CRM integration simulation |
| 4 | Analyze | Metrics, AI insights, topic optimization, campaign history |

### How Stages Connect

- Stage 1 feeds generated content into Stage 2 as editable React state
- Stage 2 passes approved content into Stage 3's HubSpot payload builder
- Stage 3 auto-saves the campaign to `window.storage` after execution completes
- Stage 4 reads from `window.storage` to populate the history table and inform topic suggestions
- The "Use as next topic" button in Stage 4 pre-fills Stage 1 and resets the pipeline — closing the optimization loop

### Data Persistence

| Data | Storage | Persists Across Sessions |
|------|---------|--------------------------|
| Generated content | React state | No |
| Campaign history | window.storage | Yes |
| Seeded past campaigns | window.storage | Yes (written on first load) |
| AI insights | React state | No |

---

## Tools & Technologies

### Frontend
- **React 18** — hooks only (`useState`, `useRef`, `useEffect`), single-file component, no build step required
- **Inline CSS** — CSS custom properties for theming, dark mode throughout
- **Google Fonts** — Syne (headings), DM Sans (body), JetBrains Mono (code/labels)

### AI Layer
- **Model** — `claude-sonnet-4-20250514` via Anthropic Messages API
- **Endpoint** — `POST https://api.anthropic.com/v1/messages`
- **Token limit** — `max_tokens: 1000` per call
- **Retry logic** — every call retries once on failure before surfacing an error

### CRM Layer
- **HubSpot REST API v3** — contacts, lists, properties, marketing emails, campaign logs
- **Auth** — Bearer token via HubSpot Private App
- **Note** — CRM calls are simulated with realistic payloads (see [Assumptions](#assumptions--known-limitations))

### Storage
- **window.storage** — Claude artifact persistence API, used for campaign history across sessions
- **Key schema** — `nm:idx` (index array), `nm:c:{id}` (individual campaign records)

---

## AI Integration Details

### Claude API Call Map

| Call | Prompt Function | Output |
|------|----------------|--------|
| Blog generation | `blogPrompt(topic)` | title, meta description, 4-section outline, ~200-word draft |
| Newsletter generation | `newsletterPrompt(topic)` | 3 newsletters with subject, preview, body (~70 words each) |
| Single newsletter regen | `singleNLPrompt(topic, persona)` | Refreshed version for one persona |
| Revision with feedback | `revisePrompt(topic, persona, current, feedback)` | Rewritten copy applying directional notes |
| 3-variant picker | `variantsPrompt(topic, persona)` | 3 versions: ROI & Urgency, Story & Social Proof, Practical How-To |
| Headline optimizer | `headlinesPrompt(title, topic)` | 4 headlines: SEO, Curiosity, Benefit-first, Contrarian |
| Performance insights | `insightsPrompt(blogTitle, metrics)` | 3-paragraph analysis with segment highlights and next steps |
| Topic optimization | `topicsPrompt(blogTitle, bestSeg, metrics, history)` | 3 topic suggestions with headline and data-backed rationale |

### Generation Strategy

Blog and newsletter content is split into **two separate API calls** rather than one. This is intentional:

- A single call requesting a full blog post plus three newsletters exceeds the 1,000-token response limit and produces truncated, unparseable JSON
- Two focused calls each comfortably fit within the limit and return clean, complete JSON every time
- A two-dot progress indicator shows which call is running

### Prompt Design

All prompts use a **schema-first JSON format** — the prompt shows the exact JSON structure with value descriptions as the field values. This approach:

- Eliminates hallucinated keys
- Reduces markdown fence wrapping (which breaks `JSON.parse`)
- Produces consistent, machine-readable output on every call

### Error Handling

- Every Claude API call retries once automatically on transient failure
- The API checks `data.error` in the response and throws explicitly with the HubSpot error message
- Generation errors surface the raw error message in the UI so the cause is always visible

---

## HubSpot CRM Integration

### API Phases

Stage 3 simulates a five-phase HubSpot distribution flow. Each phase is inspectable in the UI with full request/response JSON.

| Phase | Method | Endpoint | Description |
|-------|--------|----------|-------------|
| 1 — OAuth Token | POST | `/oauth/v1/token` | Refresh bearer token |
| 2 — Upsert Contacts | POST | `/crm/v3/objects/contacts/batch/upsert` | Create or update all 2,702 contacts |
| 3 — Create Emails | POST | `/marketing/v3/emails` | One BATCH_EMAIL draft per persona |
| 4 — Schedule Send | POST | `/marketing/v3/emails/{id}/schedule` | Set delivery date per email |
| 5 — Log Campaign | POST | `/crm/v3/objects/campaign_logs` | Write campaign metadata to CRM |

### Request Payload Structure

**Contact upsert (Phase 2)**
```json
{
  "inputs": [
    {
      "idProperty": "email",
      "id": "sarah@pixelstudio.co",
      "properties": {
        "firstname": "Sarah",
        "lastname": "Chen",
        "company": "Pixel Studio",
        "jobtitle": "Founder & CD",
        "novamind_persona": "creative_agency",
        "novamind_list_id": "list_cre_001",
        "novamind_subscribed": "true"
      }
    }
  ]
}
```

**Email creation (Phase 3)**
```json
{
  "name": "NovaMind Weekly #47 — Creative Agency Owners",
  "type": "BATCH_EMAIL",
  "content": {
    "from": { "name": "NovaMind Team", "email": "hello@novamind.ai" },
    "subject": "...",
    "previewText": "...",
    "htmlBody": "..."
  },
  "filters": {
    "contactLists": { "include": [{ "listId": "list_cre_001" }] }
  }
}
```

### Custom Contact Schema

Three custom properties are created on the HubSpot Contact object:

| Property Name | Type | Description |
|---------------|------|-------------|
| `novamind_persona` | string | Audience segment identifier |
| `novamind_list_id` | string | HubSpot list ID for this segment |
| `novamind_subscribed` | bool | Newsletter subscription status |

### Important Note on CORS

HubSpot's API does not support cross-origin browser requests — any `fetch()` call from a browser to `api.hubapi.com` is blocked with `Failed to fetch` regardless of token validity. This is a documented HubSpot policy, not a code issue.

For this reason, Stage 3 simulates the CRM flow with realistic payloads that match HubSpot's actual API schema. A production deployment would resolve this by routing all CRM calls through a lightweight Node.js proxy server:

---

## Performance Analytics

### Persona Segments & Metrics

| Segment | Subscribers | Open Rate | CTR | Unsub Rate |
|---------|-------------|-----------|-----|------------|
| Creative Agency Owners | 847 | 42.0% | 18.0% | 0.80% |
| Freelance Designers | 1,243 | 38.0% | 21.0% | 0.50% |
| Marketing Managers | 612 | 51.0% | 14.0% | 1.20% |

These are simulated values. In a production system they would be fetched from:

### AI Insights

The insights prompt passes the campaign title, all three segments' metrics, and the campaign history to Claude, which returns three paragraphs:

1. Which segment led and why — with specific numbers cited
2. One content recommendation per segment based on engagement signals
3. Two concrete next steps: one content format change and one distribution experiment

### Historical Comparison

Campaign history is stored in `window.storage` and persists across sessions. Three seed campaigns (Weeks 44, 45, 46) are written on first load so the dashboard and history table are never empty. Each campaign row shows weighted open rate, weighted CTR, and a week-over-week trend arrow.

---

## Assumptions & Known Limitations

### Simulated Components

- **HubSpot distribution** — All five CRM phases are simulated. Payloads match real HubSpot API schemas but no live portal is contacted
- **Performance metrics** — `MOCK_METRICS` contains fixed values per persona. No live analytics API is called
- **Campaign history** — Three historical campaigns are seeded on first load so the dashboard has immediate data
- **OAuth token** — The bearer token shown in Phase 1 is a redacted placeholder. A real deployment needs a live HubSpot Private App token
- **Send date** — Hardcoded to `2026-04-13`. In production this would be the current date at campaign creation
- **Subscriber counts** — 847 / 1,243 / 612 are static constants representing segment sizes

### Technical Constraints

- **CORS** — HubSpot blocks all browser-to-API calls. A server-side proxy is required for live CRM integration
- **Single-file architecture** — The entire application is one JSX file. Content generated in Stage 1 lives in React state and is lost on page refresh
- **window.storage** — Only campaign summaries (title, metrics, date) are persisted, not the full generated content
- **No authentication** — The pipeline has no login. Anyone with the artifact URL can run it

### Token Budget

`max_tokens` is set to `1000` per call. This comfortably covers current content lengths. If responses are being truncated, increase to `1500` in the `ai()` function.

---

## Bonus Features

The following features address the optional bonus requirements from the project brief:

### ⭐ AI Content Optimization
Located in Stage 4. Calls Claude with current engagement metrics, the best-performing segment, and full campaign history. Returns three next-topic suggestions each with a compelling headline and a one-sentence rationale citing the data. Clicking "Use as next topic" pre-fills Stage 1 and resets the pipeline.

### ⭐ Copy Variant Picker
Located in Stage 2. Generates three newsletter versions side-by-side for any chosen persona, each using a different persuasion angle — ROI & Urgency, Story & Social Proof, and Practical How-To. Clicking "Use This Version" applies it to the live editor.

### ⭐ Revision with Feedback
Located in Stage 2. A dedicated textarea lets the operator type directional revision notes (e.g. "make it more urgent", "add a stat"). Claude rewrites the current newsletter body applying that feedback. A version counter (v2, v3…) tracks iterations per persona tab.

### ⭐ Headline Optimizer
Located in Stage 2. Generates four alternative blog titles with named angles — SEO-optimized, Curiosity-driven, Benefit-first, and Contrarian take. Clicking any card applies it to the title field instantly.

### ⭐ Campaign History with Trend Tracking
Stored in `window.storage`, persists across sessions. Dashboard and Stage 4 both show a history table with weighted open rate, weighted CTR, and week-over-week trend arrows (↑/↓ pp vs prior campaign).

---

## Running Locally

### Option A — Claude.ai (Recommended)

No setup required.

1. Open [claude.ai](https://claude.ai) and sign in
2. Start a new conversation
3. Upload `novamind-pipeline.jsx` or paste the file contents
4. The artifact renders in the preview pane — click the eye icon if not visible
5. The Dashboard loads immediately with seeded campaign history

> The artifact calls the Anthropic API automatically using your Claude.ai session. No API key needed.

### Option B — Local React App

#### Prerequisites
- Node.js 18+
- A modern browser

#### Step 1 — Create React project

```bash
npx create-react-app novamind-pipeline
cd novamind-pipeline
cp /path/to/novamind-pipeline.jsx src/NovaMind.jsx
```

#### Step 2 — Update index.js

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import NovaMind from './NovaMind';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<NovaMind />);
```

#### Step 3 — Add window.storage polyfill

Add this before `root.render()` in `index.js`:

```javascript
window.storage = {
  get: async (key) => {
    const val = localStorage.getItem(key);
    if (val === null) throw new Error('Key not found: ' + key);
    return { key, value: val };
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return { key, value };
  },
  delete: async (key) => {
    localStorage.removeItem(key);
    return { key, deleted: true };
  },
  list: async (prefix) => {
    const keys = Object.keys(localStorage)
      .filter(k => !prefix || k.startsWith(prefix));
    return { keys };
  }
};
```

#### Step 4 — Add CORS proxy for HubSpot calls

```bash
npm install express cors node-fetch
```

Create `proxy.js`:

```javascript
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const app     = express();

app.use(cors());
app.use(express.json());

app.post('/api/hubspot/*', async (req, res) => {
  const path = req.params[0];
  const response = await fetch(`https://api.hubapi.com/${path}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.HS_TOKEN}`
    },
    body: JSON.stringify(req.body)
  });
  res.json(await response.json());
});

app.listen(3001, () => console.log('Proxy running on :3001'));
```

Run with:

```bash
HS_TOKEN=pat-na1-... node proxy.js
npm start
```

### HubSpot Private App Scopes

If connecting a real HubSpot portal, create a Private App (Settings → Integrations → Legacy Apps → Create legacy app → Private) with these scopes:

---

## Production Roadmap

The following changes would be needed to take this pipeline to production:

- **CORS proxy** — Route all HubSpot API calls through a Node.js/Express server to bypass browser CORS restrictions
- **Live analytics** — Replace `MOCK_METRICS` with real data from `GET /email/public/v1/campaigns/{id}/data` fetched 24 hours after send
- **Content persistence** — Store generated blog and newsletter content to a database (Supabase, Firebase) so it survives page refresh
- **CMS publishing** — Connect to Webflow, Contentful, or Notion to publish the blog post directly from Stage 2
- **A/B testing** — Send Variant A to 20% of the list, measure for 4 hours, send the winner to the remainder
- **Notifications** — Slack or email webhook triggered when the Stage 3 execution log completes
- **Authentication** — Add a login layer so only authorised operators can run campaigns

---

## License

MIT — free to use, modify, and distribute.

---

*NovaMind AI Marketing Pipeline · v2.1 · Built with Claude Sonnet 4 and HubSpot REST API*

