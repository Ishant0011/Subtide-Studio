# Subtide Studio — Phase 1

Word-synced caption studio for short-form portrait clips, built with Next.js App Router, TypeScript, Tailwind CSS, and pnpm.

## Phase 1 Scope

- **Landing page (`/`)** featuring the headline *"Caption your clips. Keep your style."* and a working **Try a sample** button.
- **Interactive Studio (`/studio`)** with a bundled 9:16 portrait sample clip (`public/sample-clip.mp4`) and hand-timed word-level captions (`src/lib/captions.ts`).
- **Playback-driven caption sync** tracking both the active cue and active word from the `<video>` element's playback time.
- **Controls** for play/pause, scrubbing, mute/unmute, ±2s nudging, keyboard shortcuts (`Space`, `ArrowLeft`, `ArrowRight`), and clicking any caption cue to seek.
- **Style presets**: **Clean**, **Boxed**, and **Word Highlight**.
- **Responsive layout**: side-by-side preview and caption list on desktop, stacked on phones, styled with a deep ink background, warm-white text, and mint accents.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Local Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the development server:

   ```bash
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser and click **Try a sample** (or navigate directly to [http://localhost:3000/studio](http://localhost:3000/studio)).

## Verification Commands

```bash
pnpm lint       # ESLint checks
pnpm typecheck  # TypeScript strict typecheck (tsc --noEmit)
pnpm build      # Production Next.js build
```
