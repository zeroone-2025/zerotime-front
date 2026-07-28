import {
  OG_ACCENT_COLOR,
  OG_CARD_CONTENT_TYPE,
  OG_CARD_SIZE,
  renderWordmarkCard,
} from '@/_lib/og/wordmarkCard';

// Static export를 위한 설정
export const dynamic = 'force-static';

// Image metadata
export const alt = '타임라인 (TimeLine) - 가장 편한 일정 잡기';
export const size = OG_CARD_SIZE;

export const contentType = OG_CARD_CONTENT_TYPE;

// Image generation
export default async function Image() {
  return renderWordmarkCard('TIMELINE', OG_ACCENT_COLOR.timeline);
}
