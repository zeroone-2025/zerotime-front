// 친바 "내 일정"의 슬롯 Set ↔ 시간 구간 변환.
//
// 드래그 모드와 직접 입력 모드는 같은 데이터(불가능 슬롯 Set)를 본다.
// 두 모드가 어긋나지 않도록 목록은 상태를 따로 갖지 않고 이 파일의 함수로 Set에서 파생시킨다.
//
// 슬롯 키는 "YYYY-MM-DDTHH:MM:00" — 백엔드 unavailable_slots(30분 단위 ISO datetime)와 같은 형식이라
// 변환 없이 그대로 PUT /chinba/events/{id}/my-unavailability 로 보낸다.

/** 슬롯 키 — 그리드 셀과 구간 목록이 같은 키를 쓰도록 여기 한 곳에서만 만든다. */
export const getSlotKey = (dateStr: string, time: string) => `${dateStr}T${time}:00`;

/** 시각 구간. end는 exclusive — "09:00"~"10:00"은 09:00·09:30 슬롯 두 개다. */
export interface TimeRange {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

const SLOT_MINUTES = 30;

/** "HH:MM" → 자정 기준 분 */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 자정 기준 분 → "HH:MM" */
export function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 시작 시각 선택지 — startHour ~ endHour 사이의 30분 눈금.
 * 마지막 슬롯의 시작(endHour - 30분)까지만 만든다. endHour 정각은 시작이 될 수 없다.
 */
export function buildStartOptions(startHour: number, endHour: number): string[] {
  const options: string[] = [];
  for (let m = startHour * 60; m < endHour * 60; m += SLOT_MINUTES) {
    options.push(toTimeString(m));
  }
  return options;
}

/**
 * 종료 시각 선택지 — after 이후의 30분 눈금. endHour 정각까지 포함한다(exclusive end라 필요).
 * after를 주면 그보다 늦은 시각만 남겨, 종료가 시작보다 앞서는 조합 자체를 못 만들게 한다.
 */
export function buildEndOptions(startHour: number, endHour: number, after?: string): string[] {
  const from = after ? toMinutes(after) + SLOT_MINUTES : startHour * 60 + SLOT_MINUTES;
  const options: string[] = [];
  for (let m = Math.max(from, startHour * 60 + SLOT_MINUTES); m <= endHour * 60; m += SLOT_MINUTES) {
    options.push(toTimeString(m));
  }
  return options;
}

/** 구간 → 슬롯 키 배열 (start 포함, end 제외) */
export function rangeToSlotKeys(dateStr: string, range: TimeRange): string[] {
  const keys: string[] = [];
  for (let m = toMinutes(range.start); m < toMinutes(range.end); m += SLOT_MINUTES) {
    keys.push(getSlotKey(dateStr, toTimeString(m)));
  }
  return keys;
}

/**
 * 슬롯 Set → 날짜별 연속 구간 목록.
 *
 * dates에 없는 날짜의 슬롯은 목록에서 빠진다(이벤트 후보일이 아니므로 보여줄 자리가 없다).
 * 다만 Set 자체는 건드리지 않는다 — 저장 시 그대로 보존돼야 조용한 데이터 손실이 없다.
 */
export function slotsToRangesByDate(
  slots: Set<string>,
  dates: string[]
): Map<string, TimeRange[]> {
  const dateSet = new Set(dates.map((d) => d.slice(0, 10)));
  const minutesByDate = new Map<string, number[]>();

  for (const key of slots) {
    const dateStr = key.slice(0, 10);
    if (!dateSet.has(dateStr)) continue;
    const time = key.slice(11, 16); // "HH:MM"
    const list = minutesByDate.get(dateStr);
    if (list) list.push(toMinutes(time));
    else minutesByDate.set(dateStr, [toMinutes(time)]);
  }

  const result = new Map<string, TimeRange[]>();
  for (const [dateStr, minutes] of minutesByDate) {
    const sorted = [...new Set(minutes)].sort((a, b) => a - b);
    const ranges: TimeRange[] = [];
    let blockStart = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + SLOT_MINUTES) {
        prev = sorted[i]; // 직전 슬롯과 붙어 있음 → 같은 구간
      } else {
        ranges.push({ start: toTimeString(blockStart), end: toTimeString(prev + SLOT_MINUTES) });
        blockStart = sorted[i];
        prev = sorted[i];
      }
    }
    ranges.push({ start: toTimeString(blockStart), end: toTimeString(prev + SLOT_MINUTES) });
    result.set(dateStr, ranges);
  }
  return result;
}

/** 구간 추가. Set union이라 기존 구간과 겹치면 목록에서 자연히 한 구간으로 병합된다. */
export function addRange(slots: Set<string>, dateStr: string, range: TimeRange): Set<string> {
  const next = new Set(slots);
  for (const key of rangeToSlotKeys(dateStr, range)) next.add(key);
  return next;
}

/** 구간 삭제. 긴 구간의 중간을 지우면 목록에서 두 구간으로 쪼개진다. */
export function removeRange(slots: Set<string>, dateStr: string, range: TimeRange): Set<string> {
  const next = new Set(slots);
  for (const key of rangeToSlotKeys(dateStr, range)) next.delete(key);
  return next;
}
