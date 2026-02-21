# Product Positioning: Yggdrasil

**Project:** Yggdrasil

---

## 🎯 What We Are

### Primary: Standalone Web Application (SaaS)

Yggdrasil is a **web-based compliance platform** that users access through a browser.

### Secondary: Integration-Ready (Future)

The API-first architecture allows for future integrations into existing workflows.

---

## 💡 Ideal Use Case

### For Hackathon (MVP)

**Target:** Startups and SMEs preparing for compliance audits

**Scenario:**
```
A startup founder has:
- A database with customer data
- A GDPR policy written by legal (PDF)
- 2 weeks until an audit

They need to:
- Know if their database complies with their policy
- Fix violations quickly
- Prove compliance to auditors

Yggdrasil does:
1. Upload policy PDF → Extract rules automatically
2. Connect database → Scan for violations
3. Review findings → Fix issues
4. Export report → Show auditors
```

**Time Saved:** Days → Minutes

---

### For SaaS (Post-Hackathon)

**Target:** Enterprises with multiple teams, databases, and compliance requirements

**Scenario:**
```
A compliance team at a bank has:
- 50+ databases across the organization
- Multiple policies (GDPR, HIPAA, SOC2)
- Daily data changes
- Regular audits

They need:
- Continuous monitoring
- Team collaboration
- Role-based access
- Integration with existing tools

Yggdrasil provides:
- Centralized compliance dashboard
- Scheduled scans
- Team workspaces
- API for CI/CD integration
```

---

## 🏢 Where We Fit

### Market Position

```
┌─────────────────────────────────────────────────────────────┐
│                   COMPLIANCE TOOLS MARKET                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Traditional GRC        │    Yggdrasil                 │
│   (OneTrust, Vanta)    │    (Our Position)                 │
│                          │                                   │
│   - Enterprise focus    │    - Startup/SME focus          │
│   - Manual checklists   │    - Automated scanning           │
│   - Policy-to-data gap │    - Policy→Data bridge          │
│                          │    - Explainable AI              │
│                          │                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Current Tools        │    Our Differentiation              │
│                          │                                   │
│   - Black-box AI      │    - Every violation explained    │
│   - No human review   │    - Human-in-loop               │
│   - Point-in-time     │    - Continuous monitoring        │
│   - Expensive         │    - Affordable                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Competitive Landscape

| Competitor | What They Do | Our Edge |
|------------|--------------|----------|
| **Vanta** | Compliance checklists | We scan actual data |
| **Drata** | Continuous compliance | We extract from PDFs |
| **OneTrust** | Enterprise GRC | We explain every violation |
| **SQL Linters** | Code scanning | We understand policies |

---

## 🔌 Integration vs Standalone

### Hackathon: Standalone Site

**Priority:** ✅ Primary

For MVP, we build a **standalone web application**:

```
User Flow:
1. Go to yggdrasil.ai
2. Sign up / Login
3. Upload policy PDF
4. Connect database / Upload CSV
5. Run scan
6. View violations
7. Export report
```

**Why Standalone Wins for Hackathon:**
- ✅ Easiest to demo
- ✅ Single URL for judges
- ✅ Complete user journey
- ✅ Impressive UI/UX

---

### Post-Hackathon: Standalone + Integrations

**Priority:** Future

After hackathon, we can offer:

#### 1. Browser Extension
- Scan any webpage's database
- "Check this page for PII"

#### 2. GitHub Action
- Run compliance scan on every commit
- Fail builds if violations found

#### 3. Slack Bot
- `/compliance status` command
- Alerts on new violations

#### 4. API for Enterprises
- Integrate with existing workflows
- Custom integrations

---

## 📦 Product Packaging

### MVP (Hackathon)

| Feature | Included |
|---------|----------|
| Web Application | ✅ |
| PDF Policy Upload | ✅ |
| CSV Database Upload | ✅ |
| Rule Extraction (AI) | ✅ |
| Violation Detection | ✅ |
| Human Review | ✅ |
| Export Reports | ✅ |
| Authentication | ✅ (Supabase) |
| Multi-tenant | ❌ |
| API Access | ❌ |
| Integrations | ❌ |

### Launch (Post-Hackathon)

| Feature | Included |
|---------|----------|
| All MVP features | ✅ |
| API Access | ✅ |
| Scheduled Scans | ✅ |
| Multi-policy | ✅ |
| Team Collaboration | ✅ |

### Enterprise (Future)

| Feature | Included |
|---------|----------|
| All Launch features | ✅ |
| SSO/SAML | ✅ |
| Custom Integrations | ✅ |
| Dedicated Support | ✅ |
| On-premise Option | ✅ |

---

## 🎯 Success Metrics

### For Hackathon

| Metric | Target |
|--------|--------|
| Demo works end-to-end | ✅ |
| Scan completes in <5s | ✅ |
| Judges understand value | ✅ |
| Clear differentiation | ✅ |

### For Launch

| Metric | Target |
|--------|--------|
| User signups | 100+ |
| Active users | 50+ |
| Compliance scans | 500+ |
| NPS Score | 40+ |

### For Enterprise

| Metric | Target |
|--------|--------|
| Enterprise customers | 10+ |
| API calls/day | 10K+ |
| Revenue | $50K ARR |

---

## 🗺️ Roadmap

```
Hackathon (24h)     Launch (Month 1-3)      Enterprise (Month 6+)
     │                     │                        │
     ▼                     ▼                        ▼
┌─────────┐          ┌─────────┐            ┌─────────┐
│ Standalone│         │ API      │            │ SSO     │
│ Web App  │────────▶│ Access   │──────────▶│ Custom  │
│          │         │          │            │集成     │
└─────────┘         └─────────┘            └─────────┘
```

---

## ✅ Positioning Statement

**For** startups and SMEs who need to prove database compliance

**Who** have policy documents and databases

**Yggdrasil** is a compliance platform

**That** automatically extracts rules from PDFs and scans databases for violations

**Unlike** traditional compliance tools

**We** provide explainable AI with human oversight and continuous monitoring

---

## 📋 Quick Reference

| Question | Answer |
|----------|--------|
| Are we a site or integration? | **Site first** (hackathon), then integrations |
| What's our ideal customer? | Startups/SMEs preparing for audits |
| What's our differentiator? | Policy-to-data bridge with explainability |
| What's free vs paid? | Free MVP, paid for API/Enterprise |
| Where do we host? | Vercel (frontend), Supabase (data) |

---

## 🚀 Getting Started

### For Users

1. **Sign up** at the web app
2. **Upload** your compliance policy (PDF)
3. **Connect** your database or upload CSV
4. **Scan** for violations
5. **Review** findings
6. **Export** compliance report

### For Developers (Future)

```bash
# API Access (Future)
curl -X POST https://api.yggdrasil.ai/v1/scan \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"policy_id": "xxx", "database": "xxx"}'
```
