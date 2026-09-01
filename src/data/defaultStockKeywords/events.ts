import type { Category, SeedKeyword } from './types'
import {
  easterSunday,
  iso,
  lunarNewYear,
  nthWeekday,
  productionFor,
} from './dateUtils'

/**
 * 명명된 이벤트. `target(year)` 는 해당 연도의 실제 날짜.
 * 각 이벤트는 주제 짝(인물/라이프스타일)과 배경 짝(디자인)을 가져 한 제작일의
 * 두 키워드가 역할이 다르다. `big` 이벤트는 ~D-75 제작일도 추가(분산).
 */
interface EventDef {
  name: string
  category: Category
  target: (targetYear: number) => string | null
  subjects: [string, string]
  backgrounds: [string, string]
  big?: boolean
  /** 이벤트별 제작 리드 일수 오버라이드(기본 LEAD_PRIMARY). */
  leadPrimary?: number
  leadEarly?: number
}

const LEAD_PRIMARY = 61 // ~2개월
const LEAD_EARLY = 75 // 대형 상업 이벤트의 분산 시작

const EVENTS: EventDef[] = [
  {
    name: "New Year's Day",
    category: 'holiday',
    target: (y) => iso(y, 1, 1),
    subjects: ['새해 카운트다운 불꽃놀이', '새해 다짐 노트 작성'],
    backgrounds: ['금색 색종이 새해 배경', '새해 인사 타이포 배경'],
    big: true,
  },
  {
    name: 'Lunar New Year',
    category: 'holiday',
    target: (y) => lunarNewYear(y),
    subjects: ['설날 가족 저녁상', '한복 아이 세뱃돈 봉투'],
    backgrounds: ['홍등 설날 배경', '설날 전통 문양 여백'],
  },
  {
    name: "Valentine's Day",
    category: 'holiday',
    target: (y) => iso(y, 2, 14),
    subjects: ['발렌타인 커플 선물 교환', '하트 선물 상자 손'],
    backgrounds: ['하트 발렌타인 배경 여백', '핑크 장미 발렌타인 플랫레이'],
    big: true,
    // 2027-02-14 → primary 2026-12-14, early 2026-12-01
    leadPrimary: 62,
    leadEarly: 75,
  },
  {
    name: "International Women's Day",
    category: 'holiday',
    target: (y) => iso(y, 3, 8),
    subjects: ['직장 여성 협업', '여성 창업자 발표'],
    backgrounds: ['여성의 날 꽃 배너', '여성의 날 보라 추상 배경'],
  },
  {
    name: "St Patrick's Day",
    category: 'holiday',
    target: (y) => iso(y, 3, 17),
    subjects: ['성 패트릭 파티 건배', '클로버 든 손 탁자'],
    backgrounds: ['클로버 패턴 배경 여백', '성 패트릭 러스틱 플랫레이'],
  },
  {
    name: 'Easter',
    category: 'holiday',
    target: (y) => easterSunday(y),
    subjects: ['부활절 달걀 찾기 아이들', '식탁 부활절 달걀 꾸미기'],
    backgrounds: ['파스텔 부활절 달걀 배경', '봄 부활절 플랫레이'],
    big: true,
  },
  {
    name: 'Earth Day',
    category: 'holiday',
    target: (y) => iso(y, 4, 22),
    subjects: ['지구의 날 나무 심기', '초록 새싹 든 아이'],
    backgrounds: ['초록 잎 지구의 날 배경', '재생지 친환경 플랫레이'],
  },
  {
    name: "Mother's Day",
    category: 'holiday',
    // 미국: 5월 둘째 일요일
    target: (y) => nthWeekday(y, 5, 0, 2),
    subjects: ['어버이날 꽃 선물 아이', '엄마 아침상 차리기'],
    backgrounds: ['어버이날 꽃 배경 여백', '파스텔 어버이날 선물 플랫레이'],
    big: true,
  },
  {
    name: "Father's Day",
    category: 'holiday',
    // 미국: 6월 셋째 일요일
    target: (y) => nthWeekday(y, 6, 0, 3),
    subjects: ['아버지의 날 낚시 부자', '아빠 선물 전달 아이'],
    backgrounds: ['넥타이 선물 아버지의 날 플랫레이', '네이비 아버지의 날 배경'],
  },
  {
    name: 'Graduation season',
    category: 'education',
    target: (y) => iso(y, 5, 25),
    subjects: ['졸업 학사모 던지기', '졸업식 가족 포옹'],
    backgrounds: ['학사모 졸업장 플랫레이', '졸업 축하 미니멀 배경'],
    big: true,
  },
  {
    name: 'Back to School',
    category: 'education',
    target: (y) => iso(y, 8, 25),
    subjects: ['새 학기 등굣길 아이들', '책상 문구 정리 학생'],
    backgrounds: ['새 학기 학용품 플랫레이', '칠판 새 학기 배경'],
    big: true,
  },
  {
    name: 'Halloween',
    category: 'holiday',
    target: (y) => iso(y, 10, 31),
    subjects: ['핼러윈 의상 아이들', '현관 호박 조각 가족'],
    backgrounds: ['핼러윈 호박 배경 여백', '미니멀 핼러윈 플랫레이'],
    big: true,
  },
  {
    name: 'Thanksgiving',
    category: 'holiday',
    // 미국: 11월 넷째 목요일
    target: (y) => nthWeekday(y, 11, 4, 4),
    subjects: ['추수감사절 가족 식탁', '추수감사절 구이 요리 전달'],
    backgrounds: ['가을 추수감사절 식탁 배경', '호박 추수감사절 플랫레이'],
    big: true,
  },
  {
    name: 'Black Friday',
    category: 'business',
    target: (y) => {
      const [yy, mm, dd] = nthWeekday(y, 11, 4, 4).split('-').map(Number)
      return iso(yy, mm, dd + 1) // 추수감사절 다음 날
    },
    subjects: ['블랙 프라이데이 쇼핑백', '온라인 쇼핑 신용카드'],
    backgrounds: ['블랙 프라이데이 세일 배너', '어두운 할인 태그 배경'],
    big: true,
  },
  {
    name: 'Cyber Monday',
    category: 'business',
    target: (y) => {
      const [yy, mm, dd] = nthWeekday(y, 11, 4, 4).split('-').map(Number)
      return iso(yy, mm, dd + 4) // 추수감사절 다음 월요일
    },
    subjects: ['사이버 먼데이 노트북 결제', '온라인 주문 카드 입력'],
    backgrounds: ['사이버 먼데이 IT 세일 배너', '네온 이커머스 배경'],
  },
  {
    name: 'Christmas',
    category: 'holiday',
    target: (y) => iso(y, 12, 25),
    subjects: ['가족 크리스마스 트리 장식', '크리스마스 아침 선물 개봉'],
    backgrounds: ['미니멀 크리스마스 선물 배경', '오너먼트 크리스마스 플랫레이'],
    big: true,
  },
  {
    name: "New Year's Eve",
    category: 'holiday',
    target: (y) => iso(y, 12, 31),
    subjects: ['새해 전야 샴페인 건배', '새해 전야 불꽃놀이 커플'],
    backgrounds: ['반짝이는 새해 전야 배경', '자정 불꽃놀이 보케 배경'],
  },
]

/**
 * `windowSet` 안에 제작일이 들어가는 이벤트 키워드. `targetYears` 는 이벤트를
 * 해석할 연도들(롤링 365일 창은 최대 3개 연도를 걸칠 수 있음).
 */
export function eventSeeds(
  windowSet: Set<string>,
  targetYears: number[],
): SeedKeyword[] {
  const out: SeedKeyword[] = []

  const emit = (
    productionDate: string,
    subject: string,
    background: string,
    def: EventDef,
    targetDate: string,
  ) => {
    if (!windowSet.has(productionDate)) return
    out.push({ productionDate, keyword: subject, category: def.category, event: def.name, targetDate })
    out.push({ productionDate, keyword: background, category: 'design', event: def.name, targetDate })
  }

  for (const def of EVENTS) {
    const leadPrimary = def.leadPrimary ?? LEAD_PRIMARY
    const leadEarly = def.leadEarly ?? LEAD_EARLY
    for (const targetYear of targetYears) {
      const target = def.target(targetYear)
      if (!target) continue
      emit(productionFor(target, leadPrimary), def.subjects[0], def.backgrounds[0], def, target)
      if (def.big) {
        emit(productionFor(target, leadEarly), def.subjects[1], def.backgrounds[1], def, target)
      }
    }
  }

  return out
}

export const EVENT_NAMES = EVENTS.map((e) => e.name)
