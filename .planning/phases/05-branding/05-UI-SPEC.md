# UI-SPEC — Phase 05: Brand Identity & Logo Integration (Cyber Forensic)

> **Status**: DRAFT (Review Required) | **Revision**: 1.0 | **Author**: Antigravity (Orchestrator)

---

## 🏗️ Brand Pillar: "Forensic Midnight"
The brand identity for KuratorMind is defined by **Absolute Precision** and **Expert Transparency**. It feels like a high-end forensic laboratory where complex insolvency data is synthesized into clear, legal insights.

### Core Visual Meta
- **Connectivity**: Using neural network patterns and geometric circuitry.
- **Transparency**: Magnifying glass elements used for search and discovery UI components.
- **Law & Order**: Hard-edged geometric shapes (rectangles, 90-degree lines) combined with modern sans-serif typography.

---

## 🎨 Design Tokens (Aligned with `globals.css`)

### Color Palette (60/30/10 Split)
| Type | Token | Hex | Usage |
|---|---|---|---|
| **Primary (60%)** | `--color-primary` | `#0A0E1A` | Main page backgrounds, body surfaces. |
| **Secondary (30%)** | `--color-secondary` | `#0F172A` | Sidebars, navbars, and card containers. |
| **Accent (10%)** | `--color-accent-blue` | `#3B82F6` | CTA buttons, active state indicators, logo nodes. |
| **Neutral** | `--color-text-secondary` | `#94A3B8` | Subtext and secondary labels. |

### Typography
- **Primary Typeface**: `Inter` (Sans-Serif) — Used for headers and body.
- **Data Typeface**: `JetBrains Mono` (Monospace) — Used for claims, case numbers, and AI citations.
- **Scale**:
  - `Header 1`: 28px, Bold (700)
  - `Header 2`: 20px, Semibold (600)
  - `Body`: 16px, Regular (400), 1.5 line-height

---

## 🛠️ Component Inventory (Future Integration)

### 1. The Global Navbar
- **Logo Integration**: Replaces the current text-only logo with the **kurator_mind_logo_cyber_blue.png**.
- **Alignment**: Weighted left-aligned, height constrained to 32px for premium whitespace.

### 2. Branding Assets
- **Favicon**: A simplified version of the "K-Neural" icon from the logo.
- **App Loading State**: Use the Cyber Blue node pattern as a pulsing skeleton shimmer during the 5s poll phase.

---

## 📋 Success Criteria
1. [ ] Brand-new "K-Neural" logo is correctly rendered in the Navbar without distortion.
2. [ ] Favicon is updated across all browser tabs for professional trust.
3. [ ] All primary CTA buttons use the `--color-accent-blue` (#3B82F6) consistently.
4. [ ] Monospaced JetBrains Mono is strictly used for all forensic results and case IDs.

---

> [!NOTE]
> This document is a **contract**. The "Integration Phase" will follow once the user approves these design decisions. No code changes have been made yet.
