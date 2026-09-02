/** Shared helpers for image-generation provider adapters. */

export function browserBlockedMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') return '요청이 취소되었습니다.'
  if (err instanceof TypeError) {
    return '브라우저에서 API를 직접 호출하지 못했습니다 (CORS/네트워크). 운영 배포 시에는 서버 프록시가 필요합니다.'
  }
  return err instanceof Error ? err.message : String(err)
}

/** "이미지 생성 실패 (HTTP 400): <detail>" — pulls a message out of common error bodies. */
export async function apiErrorMessage(res: Response): Promise<string> {
  let detail = ''
  try {
    const j = (await res.json()) as {
      error?: { message?: string } | string
    }
    detail =
      typeof j?.error === 'string' ? j.error : j?.error?.message ?? ''
  } catch {
    /* non-JSON error body */
  }
  return `이미지 생성 실패 (HTTP ${res.status})${detail ? `: ${detail}` : ''}`
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}
