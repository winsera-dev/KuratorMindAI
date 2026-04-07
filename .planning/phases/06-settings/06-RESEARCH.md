# Phase 06: Settings & User Preferences - Research

**Researched:** 2026-04-06
**Domain:** Next.js (App Router), Supabase Auth, React Hook Form
**Confidence:** HIGH

## Summary
The Settings menu is currently a placeholder in the Sidebar. This research defines the architecture and feature set required to move from a placeholder to a production-ready management hub. For a forensic platform like KuratorMind AI, settings must handle both standard user data (profile, security) and domain-specific forensic defaults (jurisdiction, licensing).

**Primary recommendation:** Implement a tab-based settings interface under `/settings` with three core domains: Profile, Forensic Workspace, and Security.

## User Constraints (from CONTEXT.md)
*Note: No previous CONTEXT.md exists for this phase yet. These are derived from current architecture.*
- **System Thinking:** Must integrate with existing Supabase Auth.
- **Strict Logic:** Profile updates must be atomic; license verification fields should be read-only or clearly marked as requiring admin approval if used for RBAC.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-hook-form` | ^7.48.0 | Form state management | Performant, minimal re-renders. |
| `zod` | ^3.22.4 | Schema validation | Type-safe validation shared with backend. |
| `@radix-ui/react-tabs` | ^1.0.0 | Tab navigation | Accessible, keyboard-navigable. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | Latest | Iconography | Visual categorization of settings sections. |
| `date-fns` | ^2.30.0 | Date formatting | Localizing judicial date formats for Indonesian courts. |

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/app/(app)/settings/
├── page.tsx             # Redirects to /settings/profile
├── layout.tsx           # Shared settings header & tab nav
├── profile/             # User info logic
│   └── page.tsx
├── forensic/            # Forensic workspace defaults
│   └── page.tsx
└── security/           # Auth/MFA logic
    └── page.tsx
```

### Pattern 1: Optimistic Profile Updates
**What:** Update the UI immediately while the Supabase request is in flight.
**When to use:** Name/Bio/License updates.
**Example:**
```typescript
const [isPending, startTransition] = useTransition();
const onSubmit = (data) => {
  startTransition(async () => {
    await updateProfile(data);
    toast.success("Profile updated");
  });
};
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text input validation | Custom regex | Zod | Handle edge cases like Indonesian special characters. |
| Tab accessibility | Custom buttons/state | Radix Tabs | Accessibility (ARIA) is complex for keyboard users. |
| Password Reset | Custom SMTP/Forms | Supabase Auth UI | Security risks of handling raw password tokens. |

## Common Pitfalls

### Pitfall 1: Over-fetching Auth Data
**What goes wrong:** Calling `supabase.auth.getUser()` on every settings sub-page render.
**How to avoid:** Pass the user state down from the settings layout.

### Pitfall 2: Localizing Currency wrong
**What goes wrong:** Hardcoding currency formats.
**How to avoid:** Use `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`.

## Code Examples

### Profile Schema (Forensic Focus)
```typescript
const profileSchema = z.object({
  full_name: z.string().min(2),
  license_number: z.string().regex(/^[A-Z0-9/-]+$/, "Invalid AKPI/HKPI Format"),
  specialization: z.enum(["insolvency", "audit", "legal"]),
  default_court: z.string().optional(),
});
```

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Users will need to store their professional license numbers. | Summary | Low - standard for Kurators in Indonesia. |
| A2 | Settings should be a top-level route in the `(app)` group. | Architecture | Low - matches existing Sidebar structure. |

## Open Questions
1. **MFA Support:** Do we want to enable Supabase MFA self-service in Wave 1?
2. **License Verification:** Should uploading a license cert (PDF) be part of settings, or a separate onboarding flow?

## Environment Availability
| Dependency | Required By | Available | Version |
|------------|------------|-----------|---------|
| Supabase Auth | Account management | ✓ | Local Dev |
| React Hook Form | Forms | ✓ | ^7.x |

## Validation Architecture
### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + RTL |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| SET-01 | User can update full name | E2E | `npx playwright test` |
| SET-02 | License format validation | Unit | `npm run test settings.test.ts` |

## Security Domain
### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth |
| V5 Input Validation | yes | Zod schemas |

---
**Verified by Antigravity**  
*Senior Product Architect*
