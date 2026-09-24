# SPEC — Generation (내 생성 사이트 + Direct Generate)

Two ways a keyword click can produce an image. Exactly one is active per
click, chosen by **Settings → 생성 → 기본 생성 방식** (`'my-gpt'` |
`'direct'`).

## 내 생성 사이트 (link-out) — Status: **IMPLEMENTED**, default and only
## enabled path today

No API key, no in-app image generation. Clicking a keyword:

1. Assembles the prompt: the keyword text, plus an optional image-style
   instruction appended (see below).
2. Copies it to the clipboard.
3. Opens the user's default generation site in a **new tab, every click**
   (not tab-reuse — see `docs/DECISIONS.md` for why: ChatGPT's
   `Cross-Origin-Opener-Policy: same-origin` header makes reuse impossible,
   and reuse wasn't worth the complexity at low daily click volume anyway).
4. Never auto-pastes, auto-submits, or touches the target page's DOM. Never
   auto-checks 생성 just because a tab was opened — see `docs/UI_RULES.md`.

Site presets: `src/components/settings/GeneratorsSettings.tsx` fixes three —
**ChatGPT** (`https://chatgpt.com/`), **Gemini**
(`https://gemini.google.com/app`), **Midjourney**
(`https://www.midjourney.com/imagine`) — plus arbitrary custom HTTPS links
(e.g. a personal GPT) managed below them. There is no default selected on
first run or right after this settings UI was reworked; clicking a keyword
before the user picks a default site routes to Settings instead of guessing.

**URL validation** (`src/lib/gptUrl.ts`): only `https://` is accepted;
addresses embedding credentials, `javascript:`, and `data:` are rejected.
Validated again right before use, and the opener reference on the opened tab
is severed.

A toolbar button ("생성 사이트 열기") opens just the default site without
copying a prompt, for when the user wants the tab without a specific
keyword in hand.

### Image styles

`src/domain/imageStyles.ts` — ten built-in presets (2D flat/no-outline, 3D,
line icon, isometric, watercolor, hand-drawn, paper-cut, clay, retro poster,
minimal silhouette), each a short Korean instruction string appended after
the keyword. "2D 플랫 무라인" (shown as "2D 플랫 일러스트") is the initial
selection. A "스타일 없이 키워드만 복사" option skips the instruction
entirely. Users can rename/edit/add/remove styles. Stored in `Repository`
app settings under `generator:imageStyles:v1` — **excluded from Excel
export** (style choice is a local UI preference, not planner data).

Settings for this area are split into two tabs: **1. 그림 스타일** and
**2. 생성 사이트**, in a fixed-size (max 720×740) popup whose header/tabs
stay put while only the body scrolls.

## Direct Generate — Status: **IMPLEMENTED but disabled by default**

An in-app "call an image API and show the result inline" mode. Code lives
entirely in `src/generation/` and is gated end-to-end by
`directGenerationEnabled` (`src/generation/featureFlags.ts`, env
`VITE_DIRECT_GENERATION`, **default off**). See `docs/DECISIONS.md` for why
it's off: every evaluated provider requires a paid key (Google's free tier
specifically returns a hard `429`, quota `0`, for image models — not
"exhausted," never granted).

When enabled:
- Clicking a keyword opens an internal `GenerateModal`: prompt → loading →
  image, or an error with **[다시 시도]** / **[생성 사이트로 열기]**.
- **생성 is auto-checked only on a successful generation** — never on
  failure, never just for opening the modal.
- If the default mode is Direct but no provider is configured, the modal
  offers **[API 설정]** / **[생성 사이트로 열기]** instead of failing
  silently.

Registered providers (`src/generation/providers/`):

| Provider | Models | Notes |
| --- | --- | --- |
| OpenAI | `gpt-image-1`, `dall-e-3`, `dall-e-2` | `api.openai.com` |
| Google (Gemini/Imagen) | live-queried via `ListModels`, no hardcoded default | `imagen-*` → `:predict`, `gemini-*` → `:generateContent`; free-tier prompts/output may be used for Google's training/review, so paid tier is recommended for commercial use |

`GoogleImageProvider` deliberately doesn't hardcode a preferred model id —
provider model names change often — it instead asks the API which
image-capable models the given key can use and surfaces that list on both a
successful connection test and inside a 404 error.

Adding a new provider = one adapter file implementing
`ImageGenerationProvider` + one line in `providers/index.ts`'s registry +
one entry in `PROVIDER_TYPES`. No UI/core-logic changes required. Shared
helpers (`providers/http.ts`) handle CORS-failure messaging and API error
parsing. A provider blocked by CORS in the browser surfaces "서버 프록시가
필요합니다" rather than a raw fetch failure — no proxy exists yet.

**Removal:** delete `src/generation/`, remove `<GenerationProvider>` from
`main.tsx`, remove the `directGenerationEnabled` branches (and their
imports) in `App.tsx` and `SettingsModal.tsx`. What remains works fully with
내 생성 사이트 only.

**Security:** API keys live only in `localStorage`
(`src/generation/generationConfig.ts`), never in `Repository`, never in an
Excel export, and are explicitly out of scope for the future Sync Mode
(`docs/specs/sync.md`). No server-side key storage or proxy exists — direct
browser calls to a provider that blocks CORS will fail with the message
above until a proxy is built.
