# Design Guide: Yggdrasil

**Project:** Yggdrasil

---

## 🎯 Design Philosophy

### Guiding Principles (Apple Human Interface Guidelines Inspired)

1. **Clarity** — Content is king. Remove visual noise.
2. **Deference** — UI should not compete with content.
3. **Depth** — Use visual layers to create hierarchy.
4. **Trust** — Professional, confident, reliable.

### Aesthetic Direction

**"Refined Trust"** — A sophisticated, trustworthy interface that feels like a premium financial tool. Not flashy, but polished and confident.

---

## 🎨 Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Midnight** | `#0A0F1C` | Dark backgrounds, headers |
| **Slate** | `#1E293B` | Cards, secondary backgrounds |
| **Steel** | `#334155` | Borders, dividers |
| **Silver** | `#94A3B8` | Secondary text |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Emerald** | `#10B981` | Success, compliant status |
| **Amber** | `#F59E0B` | Warning, medium risk |
| **Ruby** | `#EF4444` | Error, high risk, violations |
| **Azure** | `#3B82F6` | Primary actions, links |

### Surface Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Paper** | `#FAFBFC` | Light mode background |
| **Snow** | `#FFFFFF` | Card surfaces |
| **Mist** | `#F1F5F9` | Hover states, subtle fills |

### Dark Mode

| Name | Hex | Usage |
|------|-----|-------|
| **Obsidian** | `#0B0F19` | Dark background |
| **Charcoal** | `#151B2B` | Dark cards |
| **Graphite** | `#1E293B` | Dark borders |

---

## 🔤 Typography

### Font Stack

| Element | Font | Weight | Size |
|---------|------|--------|------|
| **Display** | Playfair Display | 600-700 | 32-48px |
| **Headings** | Inter | 600 | 20-28px |
| **Body** | Inter | 400 | 14-16px |
| **Mono** | JetBrains Mono | 400 | 13px |

### Usage Guide

```
Display: Page titles, hero text, scores
Headings: Section titles, card headers
Body: Descriptions, content, labels
Mono: Code, data, technical details
```

### Implementation

```css
/* In globals.css */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');

:root {
  --font-display: 'Playfair Display', serif;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

---

## 📐 Spacing System

### Base Units

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing, icon padding |
| `sm` | 8px | Inline elements |
| `md` | 16px | Component padding |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Page margins |
| `2xl` | 48px | Large gaps |
| `3xl` | 64px | Hero sections |

### Layout

- Max content width: `1280px`
- Sidebar width: `280px`
- Card padding: `24px`
- Grid gap: `24px`

---

## 🃏 Components (shadcn/ui)

### Core Components

| Component | Usage | Style |
|-----------|-------|-------|
| **Button** | Primary actions | Azure fill, white text |
| **Card** | Content containers | White bg, subtle shadow |
| **Table** | Violations list | Striped rows, sortable |
| **Badge** | Status indicators | Color-coded |
| **Avatar** | User identification | Circle, initials |
| **Dialog** | Modals | Centered, backdrop blur |
| **Dropdown** | Selects | Shadow, smooth animation |
| **Input** | Forms | Border on focus, validation |

### Component Customization

```typescript
// Button variants
const button = {
  primary: "bg-azure-500 text-white hover:bg-azure-600",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  ghost: "hover:bg-slate-100 text-slate-700",
  danger: "bg-ruby-500 text-white hover:bg-ruby-600",
}

// Card style
const card = {
  base: "bg-white rounded-xl border border-slate-200 shadow-sm",
  hover: "hover:shadow-md transition-shadow duration-200",
}
```

---

## 🎬 Motion & Animation

### Principles

- **Duration**: 150-300ms for interactions
- **Easing**: `ease-out` for entering, `ease-in` for exiting
- **Stagger**: 50ms delay between list items

### Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Page load | Fade in + slide up | 300ms |
| Card hover | Scale 1.02 + shadow | 200ms |
| Button press | Scale 0.98 | 100ms |
| Modal open | Fade + scale from 0.95 | 200ms |
| List items | Stagger fade in | 50ms delay |
| Score change | Counter animation | 500ms |

### Implementation

```css
/* Page transitions */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
  animation: fadeInUp 300ms ease-out forwards;
}

/* Stagger children */
.children-stagger > * {
  opacity: 0;
  animation: fadeInUp 300ms ease-out forwards;
}
.children-stagger > *:nth-child(1) { animation-delay: 0ms; }
.children-stagger > *:nth-child(2) { animation-delay: 50ms; }
.children-stagger > *:nth-child(3) { animation-delay: 100ms; }
/* ... */
```

---

## 📱 Responsive Design

### Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| `sm` | 640px | Single column |
| `md` | 768px | Sidebar + content |
| `lg` | 1024px | Full layout |
| `xl` | 1280px | Max content |

### Mobile Considerations

- Touch targets: minimum 44px
- Bottom navigation for mobile
- Swipe gestures for actions
- Collapsible sidebar

---

## ♿ Accessibility

### Requirements

- **Contrast**: Minimum 4.5:1 for text
- **Focus**: Visible focus rings
- **Keyboard**: Full navigation support
- **Screen reader**: Proper ARIA labels
- **Motion**: Respect `prefers-reduced-motion`

### Implementation

```css
/* Focus styles */
*:focus-visible {
  outline: 2px solid #3B82F6;
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 🌑 Dark Mode

### Strategy

- Use CSS variables for all colors
- Toggle class `.dark` on root
- System preference: `prefers-color-scheme`

### Dark Palette

```css
.dark {
  --bg-primary: #0B0F19;
  --bg-card: #151B2B;
  --bg-hover: #1E293B;
  --border: #334155;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
}
```

---

## ✅ Checklist

### Before Shipping

- [ ] All colors use CSS variables
- [ ] Fonts loaded and applied
- [ ] Spacing consistent with tokens
- [ ] Animations smooth (60fps)
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Focus states visible
- [ ] Contrast meets WCAG AA
