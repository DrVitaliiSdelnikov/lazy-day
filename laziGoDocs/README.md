# LaziGo Documentation

Structured documentation for the LaziGo platform.

## Structure

```
laziGoDocs/
  architecture/       — system design, scoring pipeline, data flow
  personalization/    — faceted profiles, taste learning, freshness
  data/               — venues, events, enrichment, migrations
  product/            — product brief, differentiation, roadmap
  api/                — endpoints, DTOs, auth
  deploy/             — Railway, Cloudflare, CI/CD, migrations
  ux/                 — UX specs, UI patterns, onboarding
  dev-tools/          — Reco Lab, dev-strip, testing
```

## Key Documents

| Document | Path | Description |
|---|---|---|
| Personalization Flow | `personalization/flow.md` | Full user journey: cold start to learned profile |
| Scoring Pipeline | `architecture/scoring-pipeline.md` | 17-step pipeline with weights and modifiers |
| Data Enrichment | `data/enrichment-pipeline.md` | Google + Gemini + OSM enrichment phases |
| API Reference | `api/endpoints.md` | All REST endpoints |
| Deploy Guide | `deploy/railway.md` | Prod deployment checklist |
