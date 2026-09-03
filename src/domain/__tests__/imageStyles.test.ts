import { describe, it, expect } from 'vitest'
import { resolveImageStyles, removeImageStyle } from '../imageStyles'
import { buildGeneratorText } from '../prompt'

describe('image style prompts', () => {
  it('starts with ten editable presets and the flat style selected', () => {
    const settings = resolveImageStyles(undefined)
    expect(settings.styles).toHaveLength(10)
    expect(new Set(settings.styles.map((s) => s.id)).size).toBe(10)
    const style = settings.styles.find((s) => s.id === settings.selectedId)!
    expect(buildGeneratorText('배낭 여행자 전광판', style.prompt)).toBe(
      '배낭 여행자 전광판 2D 플랫 무라인 스타일로 그려줘. 외곽선과 그림자 없이 단순한 도형과 선명한 색면을 사용하고, 흰 배경에 주제가 잘 드러나게 표현해줘.',
    )
  })

  it('uses saved custom instructions and selection on reload', () => {
    const settings = resolveImageStyles({ version: 1, styles: [
      { id: 'custom', name: '내 그림', prompt: '파스텔 색감으로 그려줘.' },
    ], selectedId: 'custom' })
    expect(buildGeneratorText('  여행자  ', settings.styles[0].prompt)).toBe('여행자 파스텔 색감으로 그려줘.')
  })

  it('chooses the next available style when the active style is deleted', () => {
    const next = removeImageStyle(resolveImageStyles(undefined), 'flat')
    expect(next.selectedId).toBe('3d')
    expect(next.styles.some((s) => s.id === 'flat')).toBe(false)
  })

  it('keeps selection when another style is deleted', () => {
    expect(removeImageStyle(resolveImageStyles(undefined), '3d').selectedId).toBe('flat')
  })

  it('does not reseed deleted presets, including after deleting the last style', () => {
    let settings = resolveImageStyles(undefined)
    for (const style of [...settings.styles]) settings = removeImageStyle(settings, style.id)
    expect(resolveImageStyles(settings)).toEqual({ version: 1, styles: [], selectedId: null })
    expect(buildGeneratorText('여행자')).toBe('여행자')
  })

  it('keeps explicit keyword-only selection and recovers a stale selection', () => {
    const defaults = resolveImageStyles(undefined)
    expect(resolveImageStyles({ ...defaults, selectedId: null }).selectedId).toBeNull()
    expect(resolveImageStyles({ ...defaults, selectedId: 'deleted' }).selectedId).toBe('flat')
  })

  it('preserves existing templates without duplicating the keyword or adding a default style', () => {
    const settings = resolveImageStyles(undefined, 'Draw {{keyword}}. Subject: {{keyword}}')
    expect(settings.selectedId).toBe('legacy')
    const selected = settings.styles.find((s) => s.id === settings.selectedId)!
    expect(buildGeneratorText('여행자', selected.prompt)).toBe('Draw 여행자. Subject: 여행자')
  })

  it('does not produce an instruction without a subject and trims blank instructions', () => {
    expect(buildGeneratorText('  ', '그려줘')).toBe('')
    expect(buildGeneratorText('여행자', '  ')).toBe('여행자')
  })
})
