import { describe, it, expect } from 'vitest'
import { isAllowedGptUrl } from '../gptUrl'

describe('isAllowedGptUrl', () => {
  it('accepts https chatgpt.com links', () => {
    expect(isAllowedGptUrl('https://chatgpt.com')).toBe(true)
    expect(isAllowedGptUrl('https://chatgpt.com/g/g-abc123-my-stock-gpt')).toBe(true)
    expect(isAllowedGptUrl('https://www.chatgpt.com/g/g-abc')).toBe(true)
    expect(isAllowedGptUrl('  https://chatgpt.com/g/g-abc  ')).toBe(true)
    expect(isAllowedGptUrl('https://CHATGPT.com/g/x')).toBe(true)
  })

  it('rejects non-https protocols', () => {
    expect(isAllowedGptUrl('http://chatgpt.com/g/x')).toBe(false)
    expect(isAllowedGptUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedGptUrl('data:text/html,<script>1</script>')).toBe(false)
    expect(isAllowedGptUrl('blob:https://chatgpt.com/uuid')).toBe(false)
  })

  it('accepts user-selected HTTPS generation websites', () => {
    expect(isAllowedGptUrl('https://gemini.google.com/app')).toBe(true)
    expect(isAllowedGptUrl('https://www.midjourney.com/imagine')).toBe(true)
    expect(isAllowedGptUrl('https://claude.ai/new')).toBe(true)
    expect(isAllowedGptUrl('https://example.com/create?mode=image')).toBe(true)
  })

  it('rejects embedded credentials', () => {
    expect(isAllowedGptUrl('https://user:password@gemini.google.com/app')).toBe(false)
    expect(isAllowedGptUrl('https://chatgpt.com@other.example/')).toBe(false)
  })

  it('rejects junk', () => {
    expect(isAllowedGptUrl('')).toBe(false)
    expect(isAllowedGptUrl('chatgpt.com/g/x')).toBe(false)
    expect(isAllowedGptUrl('not a url')).toBe(false)
  })
})
