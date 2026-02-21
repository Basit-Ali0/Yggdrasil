# Demo & Sample Data: Yggdrasil

**Project:** Yggdrasil

---

## 🎯 Demo Strategy

### The Winning Demo Flow (2 minutes)

```
[Start - 0:00] Landing Page
  - "Compliance auditing is usually a black box. Not anymore."
  - Click "Guest Demo Mode" (Instantly enters app, bypassing Auth using ephemeral session).
  
[0:15] Upload Policy
  - Drag & drop the 'AML-Standard.pdf'.
  - Show Stage 1 (Bullet Points) and Stage 2 (JSON) extractions.
  - "We turn messy legal text into executable logic stored securely in our database."
  
[0:45] Upload Data
  - Upload 'IBM-AML-Sample.csv'.
  - Show Mapping UI: "The AI detected this is IBM data and mapped 'base_amt' to 'amount' and set a 24x temporal scale."
  - Click "Approve & Scan" (Data is sampled locally for instant performance).
  
[1:15] Results Dashboard
  - Show Compliance Score Hero Card.
  - "We've grouped thousands of transactions into 12 actionable Account-based Cases."
  - Click on an Account Case (Grouping).
  
[1:45] Explainability
  - Expand a violation: "See exactly why it flagged: Amount $15k > $10k policy limit. Every violation points back to the PDF excerpt."
  
[2:00] Close
  - "Yggdrasil: From Policy to Enforcement in 120 seconds."
```

### Demo Principles

1. **Start with Value** — Use Guest Mode to show the dashboard within 10 seconds.
2. **Transparent Persistence** — Mention that policies and violations are stored in the database with RLS, ready for multi-user production.
3. **Performance Guardrails** — Briefly state: "We sample large datasets locally to ensure real-time scanning without database bloat."

---

## 📚 Additional Real-World Data Sources

### For GDPR Compliance Demo

| Source | URL | Description |
|--------|-----|-------------|
| **GDPR Violations Dataset** | https://github.com/martinhengge/GDPR | 842 GDPR violations and sanctions (2018-2022) |
| **EU Privacy Policies** | https://github.com/wi-pi/GDPR | 9,761 website privacy policies |
| **GDPR NER Dataset** | https://huggingface.co/datasets/lislia/gdpr_train | 570 privacy policies with NER annotations |

### For Landing Page Examples

Use these to showcase the app's capabilities:

- Real company privacy policies (from the datasets above)
- Common GDPR violation types (from the violations dataset)
- Sample compliance reports (generate after running scans)

---

## 📄 Sample Policy PDF

### Option 1: Download Real GDPR Policy Templates

| Source | URL | Description |
|--------|-----|-------------|
| **TermsFeed** | https://www.termsfeed.com/public/uploads/2021/12/sample-gdpr-privacy-policy-template.pdf | Real GDPR policy template |
| **Iubenda** | https://www.iubenda.com/en/blog/gdpr-privacy-policy-template/ | Free GDPR template with instructions |
| **Termly** | https://termly.io/resources/templates/privacy-policy-template/ | Privacy policy template (updated 2026) |
| **Human Focus** | https://humanfocus.co.uk/blog/free-gdpr-policy-template-and-instructions/ | UK GDPR template from ICO |

### Option 2: Create Your Own

For testing, create a PDF with these rules:

```markdown
# Company Data Policy

## Encryption Requirements
All personal data including email addresses must be encrypted at rest.

## Data Retention
Customer records must not be retained for more than 365 days.

## PII Storage
Social Security Numbers must never be stored in plain text.

## Consent
Marketing consent must be verified before sending communications.
```

### Save as: `sample-gdpr-policy.pdf`

---

## 📊 Sample CSV Data

### Option 1: Real Test Data Sources

| Source | URL | What You Get |
|--------|-----|-------------|
| **Datablist** | https://www.datablist.com/learn/csv/download-sample-csv-files | 100-2M customer records |
| **DLP Test** | https://dlptest.com/sample-data/nameccnzip/ | PII with SSN, credit cards, names |
| **PII Tools** | https://pii-tools.com/pii-examples/ | Free downloadable PII examples |
| **Tokern Piicatcher** | https://github.com/tokern/piicatcher/blob/master/tests/samples/sample-data.csv | Real PII dataset |

### Option 2: Use This Ready CSV

For demo, use this pre-built CSV with violations:

```csv
id,name,email,ssn,created_at,marketing_consent
1,John Smith,john@example.com,123-45-6789,2024-01-15,true
2,Jane Doe,jane@company.com,987-65-4321,2024-02-20,false
3,Bob Wilson,bob@test.com,NOT_STORED,2024-03-10,true
4,Alice Brown,alice@email.com,,2024-04-05,true
5,Charlie Davis,charlie@demo.com,555-01-1234,2023-01-01,true
```

### This CSV Will Generate Violations:

| Violation | Column | Why |
|-----------|--------|-----|
| Unencrypted PII | `ssn` | Contains SSN (high) |
| Old data | `created_at` | >365 days old (medium) |
| Missing consent check | `marketing_consent` | Verify before use |

---

## 🧪 Test Scenarios

### Scenario 1: Clean Data (Expected: 0 violations)

```csv
id,email,created_at
1,user@example.com,2025-01-01
```

### Scenario 2: Violations Found (Expected: 3 violations)

```csv
id,email,ssn,created_at,marketing_consent
1,john@test.com,123-45-6789,2023-01-01,true
2,jane@test.com,NOT_STORED,2024-06-15,false
```

---

## 🎬 Presentation Tips

### What Judges Want to See

1. **Problem** — Relatable pain (30 sec)
2. **Solution** — Clear approach (30 sec)
3. **Demo** — Working product (90 sec)
4. **Impact** — Future vision (30 sec)

### Common Mistakes

- ❌ Showing login flow (skip it)
- ❌ Showing error handling
- ❌ Showing every feature
- ❌ Going over time

### What Wins

- ✅ Smooth, practiced demo
- ✅ Real, meaningful data
- ✅ Clear value proposition
- ✅ Confidence, not rushing

---

## 📦 Pre-Hackathon Checklist

- [ ] Sample PDF created and tested
- [ ] Sample CSV ready with violations
- [ ] Demo script written down
- [ ] Demo practiced 10+ times
- [ ] Backup video recorded
- [ ] Tested on presentation setup

---

## 🔧 Technical Demo Tips

### For Live Demo

1. **Use localhost** — Faster, no network issues
2. **Pre-load data** — Don't demo upload
3. **Clear browser cache** — Fresh state
4. **Open dev tools** — If needed for debugging

### If Demo Fails

1. Stay calm
2. Show video backup
3. Explain what should happen
4. Offer to show later

---

## ✅ Final Check

Before going live:

- [ ] App builds without errors
- [ ] All flows work end-to-end
- [ ] Demo data loads correctly
- [ ] Scan completes in <5 seconds
- [ ] Violations display properly
- [ ] Export works
- [ ] Mobile view doesn't break
