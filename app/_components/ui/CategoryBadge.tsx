import { CATEGORY_COLORS, getColorClasses } from '@/_lib/constants/boards';
import { useAllBoards } from '@/_lib/hooks/useBoards';

interface CategoryBadgeProps {
  boardCode: string; // category에서 boardCode로 변경
}

export default function CategoryBadge({ boardCode }: CategoryBadgeProps) {
  const { data: boards } = useAllBoards();
  const board = boards?.find((b) => b.board_code === boardCode);

  const label = board?.name || boardCode;
  const color = board ? CATEGORY_COLORS[board.category] : 'gray';
  const colorClasses = getColorClasses(color);

  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorClasses.bg} ${colorClasses.text}`}
    >
      {label}
    </span>
  );
}
