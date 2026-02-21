# App Vibe: Yggdrasil

**Project:** Yggdrasil — Autonomous Policy-to-Data Compliance Engine

---

## 🎭 The Personality

### Core Identity

**"The Trusted Compliance Officer"**

Yggdrasil feels like a seasoned compliance professional — calm, precise, and trustworthy. Not flashy or overly friendly, but confident and reliable.

### Voice & Tone

| Situation | Tone |
|-----------|------|
| Explaining violations | Clear, factual, helpful |
| Showing compliance score | Proud, confident |
| Handling errors | Reassuring, solution-focused |
| Asking for input | Professional, brief |

### Phrases We Use

| Instead Of | We Say |
|------------|--------|
| "Oops! Something went wrong" | "Unable to complete scan. Please try again." |
| "You're all set!" | "Compliance scan complete." |
| "Woohoo! No violations found" | "All records compliant. 0 violations detected." |

---

## 👁️ The Look

### First Impression

When users first see Yggdrasil:

1. **Professional** — Clean lines, purposeful spacing
2. **Trustworthy** — No clutter, clear data
3. **Capable** — Dashboard shows immediate value
4. **Modern** — Smooth animations, crisp typography

### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  Logo + Navigation                            [User Menu]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              COMPLIANCE SCORE                        │   │
│  │                   85%                               │   │
│  │            ████████░░░░ 5 violations               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  HIGH (2)       │  │  MEDIUM (3)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Recent Violations                          [View All →]    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔴 Email encryption required    users.email    HIGH│   │
│  │ 🔴 PII data retention           orders.pii      HIGH│   │
│  │ 🟡 Consent not verified          customers.consentMED │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 💬 Interactions

### Scanning Flow

**User uploads policy → System thinks → User sees results**

During scanning:
- Show progress, not spinners
- Display: "Analyzing 5 tables..."
- Complete in <5 seconds

### Violation Discovery

When user clicks a violation:

1. **Policy excerpt** — "All personal data must be encrypted..."
2. **Evidence** — Actual value that triggered it
3. **Explanation** — Plain language why it violates
4. **Action** — "Mark as resolved" or "False positive"

### Empty States

| Scenario | Message |
|----------|---------|
| No policy uploaded | "Upload a policy to begin compliance checking" |
| No violations | "All records compliant" (with subtle checkmark) |
| No scan run yet | "Run your first scan to see results" |

---

## 🎯 User Journey

### New User Flow

```
1. Land on dashboard
   ↓
2. See empty state with CTA
   ↓
3. Upload policy PDF
   ↓
4. View extracted rules
   ↓
5. Upload/connect data
   ↓
6. Run scan
   ↓
7. View violations + score
   ↓
8. Review each violation
   ↓
9. Export report
```

### Returning User Flow

```
1. Land on dashboard
   ↓
2. See last scan results + score
   ↓
3. Option to re-scan or view history
   ↓
4. Review new violations
   ↓
5. Update compliance
```

---

## 🔐 Trust Signals

### What Makes Users Trust Us

1. **Explainability** — Every violation has evidence
2. **Transparency** — We show our work
3. **Control** — Users can override any finding
4. **Audit trail** — Every action is logged
5. **No black boxes** — No vague AI scores

### Trust Killers We Avoid

- ❌ Surprise charges
- ❌ Hidden data processing
- ❌ Irreversible actions without confirmation
- ❌ Vague error messages
- ❌ Slow, unresponsive UI

---

## 🎨 Mood Board

### Aesthetic Keywords

| Keyword | Implementation |
|---------|----------------|
| **Precise** | Tight spacing, aligned elements |
| **Clean** | Generous whitespace, no clutter |
| **Professional** | Serif for headings, consistent styling |
| **Calm** | Neutral colors, smooth animations |
| **Confident** | Bold scores, clear actions |

### What We Avoid

- ❌ Comic fonts
- ❌ Bright, attention-grabbing colors
- ❌ Cluttered dashboards
- ❌ Generic gradients
- ❌ Playful animations

---

## 📱 Key Screens

### Dashboard

- Large compliance score (hero element)
- Violation summary (by severity)
- Quick actions (scan, export)
- Recent activity

### Policy Upload

- Drag-and-drop zone
- Upload progress
- Extracted rules preview

### Violations List

- Sortable table
- Severity badges
- Quick filters
- Bulk actions

### Violation Detail

- Full evidence display
- Policy excerpt
- Review form
- Resolution options

---

## ♿ Accessibility Promise

Everyone can use Yggdrasil:

- Keyboard navigable
- Screen reader friendly
- High contrast mode
- Respects system preferences
- Works on slow connections

---

## 🚀 Performance Promise

The app feels instant:

- Page loads < 1 second
- Scan completes < 5 seconds
- No janky animations
- Works offline (where applicable)

---

## ✅ Design Principles Summary

| Principle | In Practice |
|-----------|-------------|
| **Clarity** | Every screen has one focus |
| **Trust** | Explainable, controllable |
| **Speed** | Instant feedback, fast scans |
| **Professional** | Serif headers, clean layout |
| **Accessible** | Works for everyone |
