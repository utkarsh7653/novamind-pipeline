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
