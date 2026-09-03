import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/Modal'
import { useDirectGenerationService, useGenerationConfig } from '../GenerationContext'
import { GenerationError, type GeneratedImage } from '../types'

type Phase = 'needs-provider' | 'generating' | 'success' | 'error'

/**
 * WOOJOO Stock Planner 내부 Generator 패널 (Direct Generate).
 * 키워드를 프롬프트로 사용해 즉시 생성하고, 성공 시에만 "생성" 자동 체크를
 * 상위(App)에 알린다. 실패 시에는 체크하지 않는다.
 */
export function GenerateModal({
  keyword,
  keywordItemId,
  hasMyGpt,
  onClose,
  onGeneratedSuccess,
  onSwitchToMyGpt,
  onOpenSettings,
}: {
  keyword: string
  keywordItemId: string
  hasMyGpt: boolean
  onClose: () => void
  onGeneratedSuccess: (keywordItemId: string) => void
  onSwitchToMyGpt: (keyword: string) => void
  onOpenSettings: () => void
}) {
  const cfg = useGenerationConfig()
  const service = useDirectGenerationService()

  const [phase, setPhase] = useState<Phase>(() =>
    service.hasUsableProvider(cfg) ? 'generating' : 'needs-provider',
  )
  const [image, setImage] = useState<GeneratedImage | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const notifiedRef = useRef(false)

  const run = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setPhase('generating')
    setErrorMsg('')
    try {
      const result = await service.generate(cfg, {
        prompt: keyword,
        signal: ac.signal,
      })
      if (ac.signal.aborted) return
      setImage(result)
      setPhase('success')
      if (!notifiedRef.current) {
        notifiedRef.current = true
        onGeneratedSuccess(keywordItemId) // 성공 시에만 "생성" 자동 체크
      }
    } catch (err) {
      if (ac.signal.aborted) return
      setPhase('error')
      setErrorMsg(
        err instanceof GenerationError || err instanceof Error
          ? err.message
          : String(err),
      )
    }
  }, [cfg, service, keyword, keywordItemId, onGeneratedSuccess])

  useEffect(() => {
    if (phase === 'generating') void run()
    return () => abortRef.current?.abort()
    // run only once on mount for the initial 'generating' state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const download = () => {
    if (!image) return
    const a = document.createElement('a')
    a.href = image.dataUrl
    a.download = `${keyword.replace(/[\\/:*?"<>|]+/g, '_') || 'image'}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Modal
      title={`Direct Generate — ${keyword}`}
      onClose={onClose}
      width={560}
      footer={
        phase === 'success' ? (
          <>
            <button className="btn" onClick={onClose}>
              닫기
            </button>
            <button className="btn" onClick={download}>
              이미지 저장
            </button>
            <button className="btn btn-primary" onClick={run}>
              다시 생성
            </button>
          </>
        ) : phase === 'error' ? (
          <>
            <button className="btn" onClick={onClose}>
              닫기
            </button>
            {hasMyGpt && (
              <button
                className="btn"
                onClick={() => onSwitchToMyGpt(keyword)}
              >
                생성 사이트로 열기
              </button>
            )}
            <button className="btn btn-primary" onClick={run}>
              다시 시도
            </button>
          </>
        ) : undefined
      }
    >
      {phase === 'needs-provider' && (
        <div className="gen-fallback">
          <p>Direct Generate를 사용하려면 API를 먼저 연결하세요.</p>
          <div className="gen-fallback-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                onClose()
                onOpenSettings()
              }}
            >
              API 설정
            </button>
            {hasMyGpt ? (
              <button className="btn" onClick={() => onSwitchToMyGpt(keyword)}>
                생성 사이트로 열기
              </button>
            ) : (
              <button
                className="btn"
                onClick={() => {
                  onClose()
                  onOpenSettings()
                }}
                title="생성 사이트가 등록되어 있지 않습니다"
              >
                생성 사이트 설정
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'generating' && (
        <div className="gen-loading">
          <div className="spinner" aria-hidden />
          <p>이미지를 생성하는 중…</p>
          <button
            className="btn btn-sm"
            onClick={() => {
              abortRef.current?.abort()
              onClose()
            }}
          >
            취소
          </button>
        </div>
      )}

      {phase === 'success' && image && (
        <div className="gen-result">
          <img src={image.dataUrl} alt={keyword} />
          <p className="hint">
            {image.provider} · {image.model} · 이 이미지는 저장되지 않습니다. 필요하면
            "이미지 저장"을 누르세요.
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className="gen-error-box">
          <p className="error-text">{errorMsg}</p>
          <p className="hint">"생성" 상태는 체크되지 않았습니다.</p>
        </div>
      )}
    </Modal>
  )
}
