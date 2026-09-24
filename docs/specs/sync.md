# SPEC — Sync Mode (multi-device)

Status: **PLANNED / NOT IMPLEMENTED.** Design is settled; no backend, no
token issuance, no UI beyond a disabled concept exists in code today. Do not
start building this without an explicit go-ahead — confirm scope with the
user first, since it involves a new backend surface (Cloudflare D1 + a
Worker/Pages Function).

## Why it doesn't exist yet

V1 ships **Local Mode only**: no login, no server account, all data in the
current browser's IndexedDB. See `docs/DATA_MODEL.md` and
`docs/PROJECT.md` for why that's the default, not just "not done yet" — it's
a deliberate privacy/simplicity stance for a personal tool.

## Target design

Two modes, **no signup/password/OAuth in either**:

```
저장 방식
 ● 이 기기에 저장        로그인 없음 (기본). 한 기기에서만 쓰면 이대로.
 ○ 여러 기기에서 동기화   링크(키)를 다른 기기에 입력 → 자동 동기화
```

### ① 이 기기에 저장 (Local, current default)

Exactly what's built today. No account, no email, nothing leaves the
browser.

### ② 여러 기기에서 동기화 (opt-in, screen-shown permanent token — no email)

1. Turning sync on asks the (future) server to create an account + a
   128-bit random token, then **shows the link/token on screen**
   (`stock.woojooland.com/#k=<token>`). **No email is sent** — the user
   copies it into a password manager or sends it to their other device
   themselves.
2. Opening that link on another device stores the token there and starts
   syncing automatically.
3. The token must live only in the URL **fragment** (`#...`), stripped from
   the address bar immediately on load (`history.replaceState`) so it
   doesn't linger in browser history, bookmarks, `Referer` headers, or
   reach any future third-party script (e.g. if ads are ever added).
4. A **"링크 다시 보기" / "재설정"** control, available from an already
   logged-in device, re-shows the same token or issues a new one (which logs
   out every other device).
5. Email delivery could be layered on **later without changing the token
   model** (an optional "also email me this link"), but is explicitly not
   part of the initial design — this was chosen over a
   Resend-style email-code flow specifically to avoid an email-service
   dependency and the DKIM/domain-verification overhead for a personal tool.

### Recovery story

- Lost the link, but at least one device is still logged in → "다시 보기"
  on that device.
- Lost every device → **Excel Full Export is the only recovery path.** This
  is true in Local Mode too — it's the universal backstop regardless of
  sync status, which is why Full Export is treated as "the official backup,"
  not just a nice-to-have (`docs/specs/excel.md`).

## Data scope

- **Synced:** `Plan`, `KeywordItem`, `KeywordStatus`, `StatusColumn`,
  `Generator` (내 생성 사이트 name/URL), `defaultGenerationMode`, and other
  general generation preferences.
- **Never synced, device-local only:** Direct Generate API keys / any
  provider credential. `providerType`/`model` could sync; `apiKey` never
  does. This mirrors today's rule that `src/generation/generationConfig.ts`
  lives outside `Repository` entirely (`docs/ARCHITECTURE.md`) — the
  boundary already exists in the codebase, sync just has to respect it.

## Conflict & transition policy (design, not implemented)

- **First Local → Sync transition** must not discard local data: offer
  `[현재 작업을 계정에 저장] [계정 데이터 불러오기] [취소]`, uploading the
  local workspace to the new account workspace on first sync.
- **Conflict policy (V1 of sync, if built): Last-Modified-Wins**, per record,
  using the `updatedAt` field every mutable entity already carries
  (`docs/DATA_MODEL.md`). No CRDT/merge logic planned initially — revisit if
  it proves too lossy in practice.
- **Deletes:** a naive hard delete would let a deleted item reappear on
  another device that hasn't seen the delete yet. A `deletedAt`/tombstone
  approach should be evaluated when this is actually built; the Local-only
  data model is not changed in anticipation of this.
- **Repository extension path:** `workspaceId` moves from the local
  placeholder to a real account/workspace id; a `D1Repository` /
  `SyncRepository` implementing the existing `Repository` interface is the
  entire integration surface UI/domain code needs to see
  (`docs/ARCHITECTURE.md`).

## Explicitly not planned

Real signup, passwords, 6-digit email codes, and OAuth were all considered
and rejected in favor of the screen-shown-token design above — see
`docs/DECISIONS.md` for the reasoning trail if reviving any of them.
