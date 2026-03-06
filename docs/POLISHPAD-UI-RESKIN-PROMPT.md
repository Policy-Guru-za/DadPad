# PolishPad UI Reskin — Wabi-Sabi Minimal Theme

## Task

You are performing a **pure visual reskin** of a desktop application called PolishPad. You will replace the existing design system (colors, typography, spacing, borders, shadows, decorative elements) with a new aesthetic direction called **"Wabi-Sabi Minimal"** — inspired by Japanese design philosophy emphasizing restraint, imperfection, and natural beauty.

**Critical constraint:** This is primarily a CSS and minor markup change. You must **not** modify any JavaScript logic, state management, event handlers, API calls, or functional behavior. Every `onClick`, `onChange`, `onPaste`, `onSelect`, `onBeforeInput` handler must remain untouched. Every piece of conditional rendering logic (streaming states, settings panel visibility, disabled states, copy feedback) must continue to work identically. The sole JSX change is a small removal described in the "JSX Change" section below.

---

## Technology Stack

- **Frontend:** React 19 + TypeScript + Vite 7
- **Desktop shell:** Tauri 2 (Rust backend — do not touch `src-tauri/`)
- **Styling:** Pure CSS with CSS custom properties (no Tailwind, no CSS modules, no styled-components)
- **Fonts:** Currently loaded via Google Fonts in `index.html`
- **Package manager:** pnpm

---

## Files You Will Modify

Three files require changes:

| File | What changes |
|---|---|
| `src/App.css` | Complete replacement of the design token system and all visual styles |
| `index.html` | Replace the Google Fonts `<link>` tag with the new font imports |
| `src/App.tsx` | One small removal (see "JSX Change" section) — no logic changes |

---

## JSX Change in `src/App.tsx`

There is exactly **one** JSX change to make. In `src/App.tsx`, find the footer's status message element — it renders the `FOOTER_HINT` constant which displays `"Transforms apply to the current editor text."`. Remove that entire element from the JSX.

Specifically, find the `<span>` (or element) with `className="status-message"` that renders `{statusMessage}` inside the `.footer` section, and **delete it entirely**. Do not remove the `.footer` container itself, the `.credit` section, or any other footer content — only the status message element.

Also remove the associated state and constant that are now unused:
- Delete the line: `const FOOTER_HINT = "Transforms apply to the current editor text.";`
- Delete the line: `const [statusMessage, setStatusMessage] = useState(FOOTER_HINT);`
- Remove any references to `setStatusMessage` throughout the file (these are calls that update the status text during transforms — since the element no longer renders, these become dead code). If removing `setStatusMessage` calls feels risky because they're interleaved with other logic, you may alternatively just leave them as harmless no-ops — but removing the JSX element and the constant/state declaration is required.

**Do not change any other JSX, handlers, state, or logic.**

---

## Current Design System (What You Are Replacing)

### Current Fonts (in `index.html`)
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

### Current CSS Custom Properties (in `src/App.css` `:root`)
```css
--font-body: "DM Sans", "Avenir Next", "Segoe UI", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", ui-monospace, monospace;

--bg-base: #f5f3ef;
--bg-warm: #ece8e1;
--bg-card: #fffffe;
--bg-card-bottom: #faf9f7;
--border-card: rgba(0, 0, 0, 0.06);
--border-subtle: rgba(0, 0, 0, 0.08);

--ink-primary: #1a1a1a;
--ink-secondary: #5c5c5c;
--ink-muted: #8a8a8a;
--ink-faint: #b0aeab;

--accent: #2d5be3;
--accent-hover: #1d4ed8;
--accent-glow: rgba(45, 91, 227, 0.12);
--accent-soft: #e8eefb;

--success: #1a7a5c;
--warning-text: #b45309;
--error-text: #c2410c;

--shadow-card: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 32px rgba(0, 0, 0, 0.06);
--shadow-inset: inset 0 2px 4px rgba(0, 0, 0, 0.04);

--space-xs: 6px;
--space-sm: 12px;
--space-md: 20px;
--space-lg: 32px;
--space-xl: 48px;

--radius-lg: 20px;
--radius-md: 14px;
--radius-sm: 10px;
--radius-xs: 8px;

--transition-fast: 140ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-smooth: 260ms cubic-bezier(0.4, 0, 0.2, 1);
```

---

## New Design System (What You Are Implementing)

### Design Philosophy: Wabi-Sabi Minimal

The aesthetic draws from Japanese concepts of wabi (austere beauty) and sabi (the beauty of age and wear). The UI should feel like quality stationery on a writing desk — the kind of object you'd find in a Muji store or a traditional Japanese paper shop. It favors restraint over ornamentation, natural materials over synthetic ones, and quiet confidence over loud expressiveness.

Key principles:
- **Extreme typographic restraint.** One serif display font (Cormorant Garamond) for headings, brand, and placeholders. One clean sans-serif (Karla) for body text and UI controls. No monospace font — stats use the sans-serif with tabular numerals.
- **Paper-like surfaces.** No glossy cards, no gradients, no elevation-heavy shadows. The entire UI sits on a warm, slightly textured paper background with minimal visual separation between regions.
- **Near-zero border radius.** Where the current design uses 8–20px radii for soft, rounded shapes, the new design uses 0–2px radii exclusively. Corners are sharp or barely softened.
- **Vermillion as the sole accent.** The current blue accent is replaced entirely by a Japanese vermillion red (`#c5453a`), used sparingly — only for the ink-line accent mark, hover states on tone buttons, the hanko stamp, and error/warning states. The dominant palette is grayscale with warm undertones.
- **Generous vertical breathing room.** Spacing is asymmetric and generous, especially around the header and between major sections.

### New Font Imports (for `index.html`)

In `index.html`, find the existing Google Fonts `<link>` tag (the one loading `DM+Sans` and `JetBrains+Mono`) and replace it with:

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Karla:wght@300;400;500&display=swap" rel="stylesheet" />
```

Keep the two `<link rel="preconnect">` tags above it — they are still needed for Google Fonts performance.

### New CSS Custom Properties

Replace the entire `:root` block with:

```css
:root {
  /* ── Typography ── */
  --font-body: "Karla", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --font-display: "Cormorant Garamond", "Georgia", "Times New Roman", serif;
  --font-mono: "Karla", system-ui, sans-serif;  /* No monospace — use sans with tabular-nums */

  /* ── Color: Ink & Paper ── */
  --sumi: #1c1b18;               /* Deepest ink — primary text, Polish button fill */
  --charcoal: #363530;           /* Dark secondary — hover states */
  --warm-gray: #7a7870;          /* Mid tone — secondary text, stat values */
  --ash: #a8a49c;                /* Light tone — muted text, labels, placeholders */
  --washi: #eae6de;              /* Paper border — dividers, input borders */
  --paper: #f4f1eb;              /* Page background — warm off-white */
  --snow: #faf8f4;               /* Editor surface — lightest warm white */

  /* ── Color: Accent ── */
  --vermillion: #c5453a;         /* Japanese vermillion — sole accent color */
  --vermillion-soft: rgba(197, 69, 58, 0.08);   /* Vermillion tint for hover backgrounds */
  --vermillion-border: rgba(197, 69, 58, 0.2);  /* Vermillion for hover borders */

  /* ── Mapped to existing variable names (for compatibility) ── */
  --bg-base: var(--paper);
  --bg-warm: var(--washi);
  --bg-card: var(--paper);           /* No card elevation — sits flush on background */
  --bg-card-bottom: var(--paper);
  --border-card: transparent;         /* No card border visible */
  --border-subtle: var(--washi);

  --ink-primary: var(--sumi);
  --ink-secondary: var(--warm-gray);
  --ink-muted: var(--ash);
  --ink-faint: var(--washi);

  --accent: var(--sumi);              /* Primary action color is ink, not blue */
  --accent-hover: var(--charcoal);
  --accent-glow: rgba(28, 27, 24, 0.06);
  --accent-soft: rgba(28, 27, 24, 0.04);

  --success: #5a7a5e;                /* Muted sage green for success states */
  --warning-text: var(--vermillion);  /* Vermillion for warnings */
  --error-text: var(--vermillion);    /* Vermillion for errors */

  /* ── Shadows ── */
  --shadow-card: none;                                    /* No card shadow */
  --shadow-inset: none;                                   /* No inset shadow */
  --shadow-focus: 0 8px 40px rgba(28, 27, 24, 0.04);     /* Subtle focus glow */

  /* ── Spacing ── */
  --space-xs: 6px;
  --space-sm: 12px;
  --space-md: 20px;
  --space-lg: 36px;      /* Slightly more generous than current */
  --space-xl: 48px;

  /* ── Radii ── */
  --radius-lg: 0px;       /* Sharp corners everywhere */
  --radius-md: 0px;
  --radius-sm: 2px;        /* Barely-there softening for small elements */
  --radius-xs: 2px;

  /* ── Transitions ── */
  --transition-fast: 200ms ease;
  --transition-smooth: 350ms cubic-bezier(0.22, 1, 0.36, 1);
}
```

---

## Detailed Style Specifications by Component

Below is every CSS class in the application and the exact new style it should receive. Where a class is not mentioned, it should inherit naturally from the new custom properties and require no additional changes.

### 1. Root & Body

```css
:root {
  font-size: 15px;
  line-height: 1.5;
  font-weight: 400;
  color: var(--sumi);
  background-color: var(--paper);
  font-family: var(--font-body);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

No other changes to global reset styles.

### 2. `.app-shell` (Main Container)

The current design renders this as a floating card with rounded corners, a gradient background, and a prominent box shadow. The new design removes all card-like elevation:

```css
.app-shell {
  width: 100%;
  max-width: 720px;           /* Slightly narrower than current 1060px — tighter, more editorial */
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
  background: var(--paper);   /* Flush with page background — no card separation */
  border: none;               /* No card border */
  border-radius: 0;           /* Sharp corners */
  box-shadow: none;           /* No elevation */
  display: flex;
  flex-direction: column;
  min-height: 100vh;          /* Fill viewport */
  position: relative;
  animation: breathe 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}
```

Replace the existing `fadeSlideUp` keyframes with:

```css
@keyframes breathe {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

This is a simple opacity fade — no translateY movement. The entrance should feel like a page materializing, not sliding in.

### 3. `.toolbar` (Top Action Bar)

The toolbar should feel like a masthead. Generous bottom margin to create breathing room before the controls.

```css
.toolbar {
  display: flex;
  align-items: flex-end;       /* Bottom-align items */
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: 0;                  /* No padding — the shell handles it */
  margin-bottom: var(--space-xl);
  border-bottom: 1px solid var(--sumi);  /* Strong ink line below */
  padding-bottom: var(--space-lg);
  position: relative;
}
```

Add a vermillion accent mark on the toolbar's bottom border using `::after`:

```css
.toolbar::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 48px;
  height: 3px;
  background: var(--vermillion);
  opacity: 0.6;
}
```

### 4. `.toolbar-label` (Section Labels)

```css
.toolbar-label {
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 300;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--ash);
}
```

### 5. `.polish-btn` (Primary Polish Button)

The Polish button becomes a refined, outlined rectangle with an ink-fill hover animation:

```css
.polish-btn {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 1px;
  padding: 10px 32px;
  background: transparent;
  color: var(--sumi);
  border: 1.5px solid var(--sumi);
  border-radius: 0;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: color var(--transition-smooth);
}

.polish-btn::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 100%;
  background: var(--sumi);
  transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  z-index: 0;
}

.polish-btn:hover:not(:disabled)::before {
  width: 100%;
}

.polish-btn:hover:not(:disabled) {
  color: var(--paper);
}
```

For the streaming state, keep the pulsing dot but change its color:

```css
.polish-btn.streaming::after {
  /* Keep existing positioning and animation */
  background: var(--vermillion);  /* Vermillion instead of blue */
}
```

Disabled state:

```css
.polish-btn:disabled {
  opacity: 0.3;
  cursor: default;
  border-color: var(--ash);
  color: var(--ash);
}
```

### 6. `.segmented-control` / `.tone-control` (Tone Mode Selector)

Remove the warm background pill container and make the buttons free-standing:

```css
.segmented-control {
  display: flex;
  gap: 2px;
  background: transparent;      /* No background container */
  padding: 0;                   /* No padding */
  border-radius: 0;
  border: none;
}
```

### 7. `.mode-btn` (Casual / Professional / Direct Buttons)

```css
.mode-btn {
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 300;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--washi);
  border-radius: 0;
  color: var(--ash);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn:first-child { border-radius: 2px 0 0 2px; }
.mode-btn:last-child { border-radius: 0 2px 2px 0; }

.mode-btn:hover:not(:disabled) {
  border-color: var(--vermillion-border);
  color: var(--vermillion);
  background: var(--vermillion-soft);
}

.mode-btn.active {
  background: var(--sumi);
  color: var(--paper);
  border-color: var(--sumi);
  font-weight: 400;
  box-shadow: none;
}

.mode-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
```

### 8. `.tone-helper` (Unlock Hint Text)

```css
.tone-helper {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-style: italic;
  font-weight: 300;
  color: var(--ash);
}
```

### 9. `.action-btn` (Cancel, Undo, Settings)

```css
.action-btn {
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 400;
  padding: 8px 16px;
  background: transparent;
  color: var(--warm-gray);
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: color 0.2s ease;
  letter-spacing: 0.3px;
}

.action-btn:hover:not(:disabled) {
  color: var(--sumi);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
```

### 10. `.action-btn.primary` (Copy Button)

```css
.action-btn.primary {
  background: var(--sumi);
  color: var(--paper);
  font-weight: 500;
  border-radius: 2px;
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--charcoal);
  color: var(--snow);
}

.action-btn.primary.copied {
  background: var(--success);
  color: var(--snow);
}
```

### 11. `.action-btn.settings-trigger` (Settings Button)

```css
.action-btn.settings-trigger {
  border: 1px solid var(--washi);
  border-radius: 2px;
  color: var(--ash);
}

.action-btn.settings-trigger:hover:not(:disabled) {
  border-color: var(--ash);
  color: var(--warm-gray);
}
```

### 12. `.settings-panel` (Settings Container)

```css
.settings-panel {
  background: var(--snow);
  border: 1px solid var(--washi);
  border-radius: 0;
  padding: var(--space-md);
  margin: 0 0 var(--space-md) 0;
}
```

### 13. `.settings-input` (Form Inputs)

```css
.settings-input {
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: 8px 12px;
  background: var(--paper);
  border: 1px solid var(--washi);
  border-radius: 0;
  color: var(--sumi);
  transition: border-color 0.2s ease;
}

.settings-input:focus {
  border-color: var(--sumi);
  outline: none;
  box-shadow: none;   /* No blue glow — just a stronger border */
}
```

### 14. `.save-settings-button` (Save Button)

```css
.save-settings-button {
  background: var(--sumi);
  color: var(--paper);
  font-weight: 500;
  border: none;
  border-radius: 2px;
  padding: 8px 20px;
  cursor: pointer;
}

.save-settings-button:hover {
  background: var(--charcoal);
}
```

### 15. `.settings-warning` (API Key Warning)

```css
.settings-warning {
  color: var(--vermillion);
  font-size: 0.85rem;
  font-weight: 500;
}
```

### 16. `.editor-area` (Editor Section Container)

```css
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  margin-bottom: var(--space-lg);
  animation: breathe 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
}
```

### 17. `.editor-label` ("YOUR TEXT" Label)

```css
.editor-label {
  font-size: 0.62rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--ash);
  font-weight: 400;
  margin-bottom: var(--space-sm);
}
```

### 18. `.editor-wrapper` (Textarea Border Container)

```css
.editor-wrapper {
  background: var(--snow);
  border: 1px solid var(--washi);
  border-radius: 0;            /* Sharp corners */
  box-shadow: none;            /* No inset shadow */
  transition: all 0.3s ease;
}

.editor-wrapper:focus-within {
  border-color: rgba(28, 27, 24, 0.15);
  box-shadow: var(--shadow-focus);
}
```

### 19. `.editor` (Main Textarea — `#editor`)

```css
.editor {
  width: 100%;
  min-height: 400px;           /* Slightly taller than current 380px */
  padding: 32px 36px;          /* More generous padding */
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 300;            /* Light weight for body text */
  line-height: 2;              /* Very generous line height — 2.0 vs current 1.65 */
  color: var(--sumi);
  background: transparent;
  border: none;
  outline: none;
  resize: vertical;
}

.editor::placeholder {
  color: var(--ash);
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 300;
  font-size: 1rem;
}
```

### 20. `.stats-bar` (Statistics Footer)

```css
.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 0;
  margin-bottom: var(--space-sm);
  font-family: var(--font-body);  /* Use sans-serif, not monospace */
  font-size: 0.68rem;
  font-weight: 300;
  color: var(--ash);
  border-top: 1px solid var(--washi);    /* Thin divider above stats */
  padding-top: var(--space-sm);
}

.stat-item {
  font-weight: 300;
  color: var(--ash);
}

.stat-item strong,
.stat-item b {
  font-weight: 500;
  color: var(--warm-gray);
  font-variant-numeric: tabular-nums;
}

.stat-divider {
  /* Keep existing structure but make thinner/subtler */
  background: var(--washi);
  opacity: 0.5;
}
```

### 21. `.copy-feedback` (Copy Success Message)

```css
.copy-feedback {
  color: var(--success);
  font-weight: 500;
}
```

### 22. `.footer` (Bottom Footer)

```css
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: 0;
}
```

### 23. `.status-message` (Removed)

This element has been removed from the JSX (see "JSX Change" section above). You may delete the `.status-message` CSS rule entirely, or leave it as dead CSS — either is fine.

### 24. `.credit` and Children (Creator Attribution)

```css
.credit {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.65rem;
  color: var(--ash);
  letter-spacing: 0.5px;
}

.credit-handle {
  font-weight: 500;
  color: var(--warm-gray);    /* Not accent-colored — understated */
}

.credit-flag {
  font-size: 0.75rem;
}
```

### 25. Toolbar Structure Classes

These classes control the flex layout of the toolbar. They need minimal visual changes — mostly removing backgrounds and adjusting alignment to match the new flat aesthetic:

```css
.toolbar-section {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
}

.transform-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.toolbar-actions {
  display: flex;
  gap: 4px;
  align-items: flex-end;
}

.transform-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.transform-panel-primary {
  /* No specific new styles — inherits from .transform-panel */
}

.transform-panel-tone {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.transform-panel-tone.locked {
  opacity: 0.3;
}

.transform-panel-tone.unlocked {
  opacity: 1;
}
```

### 26. Tone Section Sub-Classes

```css
.tone-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tone-control {
  /* Same as .segmented-control — no background, no padding */
  position: relative;
}
```

### 27. Settings Form Structure Classes

```css
.settings-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm) var(--space-md);
  margin-bottom: var(--space-md);
}

.settings-field {
  font-family: var(--font-body);
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--warm-gray);
  letter-spacing: 0.3px;
}

.settings-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.85rem;
  color: var(--sumi);
  cursor: pointer;
}

.settings-toggle-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-help {
  font-size: 0.72rem;
  font-weight: 300;
  color: var(--ash);
  padding-left: 24px;    /* Indent under checkbox */
  line-height: 1.4;
}

.settings-actions {
  display: flex;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--washi);
  margin-top: var(--space-sm);
}

.settings-message {
  font-size: 0.78rem;
  color: var(--vermillion);
  font-weight: 400;
}
```

### 28. Credit Sub-Classes

```css
.credit-dot {
  color: var(--washi);
  font-size: 0.6rem;
}

.credit-location {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ash);
  font-weight: 300;
}

.credit-flag {
  font-size: 0.75rem;
}
```

### 29. Editor Readonly State

When the editor is in readonly mode (during streaming), it should visually indicate reduced interactivity:

```css
.editor[readonly] {
  opacity: 0.7;
  cursor: default;
  color: var(--warm-gray);
}
```

### 30. Screen Reader Only (Accessibility — Do Not Change)

```css
.sr-only {
  /* Keep exactly as-is — this is a standard accessibility pattern */
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### 31. Responsive Breakpoint (`@media (max-width: 720px)`)

```css
@media (max-width: 720px) {
  :root {
    padding: var(--space-sm);
  }

  .app-shell {
    padding: var(--space-lg) var(--space-md);
    border-radius: 0;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
    margin-bottom: var(--space-lg);
  }

  .editor {
    min-height: 340px;
    padding: 24px 20px;
  }

  .footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings-form {
    grid-template-columns: 1fr;
  }
}
```

---

## Animations

Replace all existing keyframe definitions with:

```css
@keyframes breathe {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}
```

The `pulse` animation is used for the streaming indicator dot on `.polish-btn.streaming::after` — keep it functional but ensure the dot color is `var(--vermillion)`.

---

## What Must NOT Change

To be absolutely explicit, do **not** modify anything in these files (except `App.tsx` which receives only the removal described in the "JSX Change" section):

- `src/App.tsx` — Only the status-message removal described above; no other JSX, handler, or import changes
- `src/providers/openai.ts`
- `src/providers/openaiPrompting.ts`
- `src/settings/config.ts`
- `src/protect/placeholders.ts`
- `src/structuring/plainText.ts`
- `src/utils/truncation.ts`
- `src-tauri/*` — No Rust or Tauri config changes
- `vite.config.ts`
- `tsconfig.json`
- `package.json`

Do not add any new npm dependencies. Do not add any new files. Do not rename any CSS class names or HTML element IDs. Do not change any `className` strings in JSX.

---

## Summary of Changes

| Aspect | Before | After |
|---|---|---|
| **Display font** | DM Sans (all weights) | Cormorant Garamond (300, 400, 500, italic) |
| **Body font** | DM Sans | Karla (300, 400, 500) |
| **Mono font** | JetBrains Mono | Removed — Karla with `tabular-nums` |
| **Background** | Warm beige `#f5f3ef` | Warmer paper `#f4f1eb` |
| **Card style** | Floating card with shadow + rounded corners | Flat, flush with background, no shadow |
| **Border radius** | 8–20px throughout | 0–2px throughout |
| **Accent color** | Blue `#2d5be3` | Sumi ink `#1c1b18` for primary actions, Vermillion `#c5453a` for hover/warning |
| **Polish button** | Blue gradient fill | Transparent with ink border, ink-fill animation on hover |
| **Tone buttons** | Pill-shaped in rounded container | Flat rectangles with washi borders, vermillion hover |
| **Copy button** | Blue background | Sumi ink background |
| **Shadows** | Card shadow + inset shadow + accent glow | No shadows (only subtle focus shadow on editor) |
| **Editor line-height** | 1.65 | 2.0 |
| **Editor border** | Rounded, subtle | Sharp, washi-colored |
| **Stats font** | JetBrains Mono (monospace) | Karla (sans-serif, tabular-nums) |
| **Toolbar divider** | None visible | Strong ink line with vermillion accent mark |
| **Entrance animation** | Slide up + fade | Fade only (opacity) |
| **Overall feel** | Modern SaaS product | Japanese stationery / paper shop |

---

## Verification

After making changes, verify:

1. `pnpm dev` compiles without errors
2. The Polish button still triggers transforms when clicked
3. Tone buttons unlock after a Polish pass (the `hasPolishedCurrentSession` state)
4. The streaming indicator dot still pulses during API calls
5. The Copy button still shows the `.copied` class feedback
6. The Settings panel still opens/closes and saves correctly
7. The responsive layout still works at narrow viewport widths
8. All disabled states (no API key, streaming in progress) still visually indicate disabled
9. The editor textarea still accepts input, pastes, and displays placeholder text
10. The Undo button still restores previous text

No functional behavior should have changed. This is purely a visual transformation.
