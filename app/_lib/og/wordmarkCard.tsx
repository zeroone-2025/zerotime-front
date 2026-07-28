import { ImageResponse } from 'next/og';

/** 링크 프리뷰 카드 규격 — 1200×630은 카카오톡·디스코드·슬랙 공통 안전지대 */
export const OG_CARD_SIZE = { width: 1200, height: 630 };
export const OG_CARD_CONTENT_TYPE = 'image/png';

/** 워드마크 옆 강조 사각형 색 — 서비스별로 이 값만 다르다 */
export const OG_ACCENT_COLOR = {
  zerotime: '#3B82F6',
  timeline: '#10B981',
} as const;

/**
 * 워드마크 + 강조 사각형 카드를 굽는다 (빌드 타임 — 각 라우트의 opengraph-image가 호출).
 *
 * ⚠️ wordmark에는 **라틴 문자만** 넣는다. satori는 시스템 폰트 폴백이 없어서
 * 아래 Inter latin 서브셋에 없는 글리프(한글 등)는 빈칸으로 렌더된다.
 */
export async function renderWordmarkCard(wordmark: string, accentColor: string) {
  // Font loading
  // Using standard fetch without import.meta.url for better compatibility
  const interBold = await fetch(
    'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-800-normal.woff'
  ).then((res) => {
    if (!res.ok) {
      throw new Error('Failed to fetch font');
    }
    return res.arrayBuffer();
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
          }}
        >
          {/* Wordmark */}
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: '128px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#111827',
              transform: 'skewX(-6deg)',
            }}
          >
            {wordmark}
          </div>

          {/* Design Detail: Brand Accent Dot (Square) */}
          <div
            style={{
              width: '35px',
              height: '35px',
              backgroundColor: accentColor,
              marginLeft: '24px',
              transform: 'skewX(-6deg)',
            }}
          />
        </div>
      </div>
    ),
    {
      ...OG_CARD_SIZE,
      fonts: [
        {
          name: 'Inter',
          data: interBold,
          style: 'normal',
          weight: 800,
        },
      ],
    }
  );
}
