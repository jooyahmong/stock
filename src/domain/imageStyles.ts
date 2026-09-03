export interface ImageStyle {
  id: string
  name: string
  prompt: string
}

export interface ImageStyleSettings {
  version: 1
  styles: ImageStyle[]
  selectedId: string | null
}

// Retained only to recognize unedited presets saved by earlier versions.
const PREVIOUS_IMAGE_STYLES: ImageStyle[] = [
  { id: 'flat', name: '2D 플랫 무라인', prompt: '2D 플랫 무라인 스타일로 그려줘. 외곽선과 그림자 없이 단순한 도형과 선명한 색면을 사용하고, 흰 배경에 주제가 잘 드러나게 표현해줘.' },
  { id: '3d', name: '3D', prompt: '3D 일러스트 스타일로 그려줘. 부드러운 조명, 둥근 형태, 자연스러운 입체감과 은은한 그림자를 사용하고 깔끔한 배경으로 표현해줘.' },
  { id: 'line', name: '라인 아이콘', prompt: '라인 아이콘 스타일로 그려줘. 일정한 두께의 깔끔한 선과 단순한 형태를 사용하고, 채색과 그림자 없이 흰 배경에 표현해줘.' },
  { id: 'isometric', name: '아이소메트릭', prompt: '아이소메트릭 일러스트 스타일로 그려줘. 사선 위에서 내려다보는 등각 투시, 정돈된 기하학적 형태, 제한된 색상과 깔끔한 배경을 사용해줘.' },
  { id: 'watercolor', name: '수채화', prompt: '수채화 일러스트 스타일로 그려줘. 투명한 물감의 번짐, 자연스러운 붓 자국, 부드러운 색감을 살리고 흰 종이 배경에 표현해줘.' },
  { id: 'hand-drawn', name: '손그림', prompt: '따뜻한 손그림 일러스트 스타일로 그려줘. 자연스러운 연필과 색연필 질감, 조금 불규칙한 선, 부드러운 색상과 단순한 배경을 사용해줘.' },
  { id: 'paper-cut', name: '페이퍼컷', prompt: '페이퍼컷 일러스트 스타일로 그려줘. 색종이를 오려 겹친 듯한 형태, 종이 질감과 층 사이의 은은한 그림자를 살려 표현해줘.' },
  { id: 'clay', name: '클레이', prompt: '클레이 일러스트 스타일로 그려줘. 점토로 빚은 듯한 둥글고 귀여운 형태, 부드러운 무광 질감, 파스텔 색상과 깔끔한 배경을 사용해줘.' },
  { id: 'retro', name: '레트로 포스터', prompt: '레트로 포스터 일러스트 스타일로 그려줘. 단순하고 대담한 구도, 따뜻한 제한 색상과 인쇄 종이 질감을 사용하고 글자 없이 이미지로 표현해줘.' },
  { id: 'silhouette', name: '미니멀 실루엣', prompt: '미니멀 실루엣 스타일로 그려줘. 주제의 특징을 알아볼 수 있는 단순한 윤곽과 단색 면을 사용하고, 흰 배경에 세부 장식 없이 표현해줘.' },
]

export const DEFAULT_IMAGE_STYLES: ImageStyle[] = PREVIOUS_IMAGE_STYLES.map((style) => ({
  ...style,
  name: style.id === 'flat' ? '2D 플랫 일러스트' : style.name,
  prompt: style.id === 'flat'
    ? '2D 플랫 일러스트 스타일의 그림을 그려줘. 단순한 도형과 선명한 색면, 흰 배경을 사용해줘. 설명문이 아니라 실제 이미지를 생성해줘.'
    : style.prompt.replace('스타일로 그려줘', '스타일의 그림을 그려줘').split('표현해줘').join('그림을 그려줘')
      + ' 설명문이 아니라 실제 이미지를 생성해줘.',
}))

function updateUneditedPreset(style: ImageStyle): ImageStyle {
  const previous = PREVIOUS_IMAGE_STYLES.find((item) => item.id === style.id)
  const current = DEFAULT_IMAGE_STYLES.find((item) => item.id === style.id)
  if (!previous || !current) return style
  return {
    ...style,
    name: style.name === previous.name ? current.name : style.name,
    prompt: style.prompt === previous.prompt ? current.prompt : style.prompt,
  }
}

/** Missing preferences get defaults; an intentionally empty list stays empty. */
export function resolveImageStyles(saved: ImageStyleSettings | undefined, legacyTemplate?: string): ImageStyleSettings {
  if (saved) {
    return {
      ...saved,
      styles: saved.styles.map(updateUneditedPreset),
      selectedId: saved.selectedId === null ? null
        : saved.styles.find((s) => s.id === saved.selectedId)?.id ?? saved.styles[0]?.id ?? null,
    }
  }
  const styles = DEFAULT_IMAGE_STYLES.map((style) => ({ ...style }))
  if (legacyTemplate?.includes('{{keyword}}')) {
    styles.push({ id: 'legacy', name: '기존 프롬프트', prompt: legacyTemplate })
    return { version: 1, styles, selectedId: 'legacy' }
  }
  return { version: 1, styles, selectedId: styles[0].id }
}

export function removeImageStyle(settings: ImageStyleSettings, id: string): ImageStyleSettings {
  const styles = settings.styles.filter((style) => style.id !== id)
  return { ...settings, styles, selectedId: settings.selectedId === id ? styles[0]?.id ?? null : settings.selectedId }
}
