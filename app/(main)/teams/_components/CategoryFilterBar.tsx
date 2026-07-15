'use client';

import type { EventCategory } from '@/_types/team';

interface CategoryFilterBarProps {
  categories: EventCategory[];
  selectedCategoryId: number | null;
  onChange: (categoryId: number | null) => void;
}

export default function CategoryFilterBar({
  categories,
  selectedCategoryId,
  onChange,
}: CategoryFilterBarProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
      <button
        onClick={() => onChange(null)}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          selectedCategoryId === null
            ? 'bg-gray-700 text-white'
            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        }`}
      >
        전체
      </button>
      {categories.map((category) => {
        const isSelected = selectedCategoryId === category.id;
        return (
          <button
            key={category.id}
            onClick={() => onChange(isSelected ? null : category.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelected
                ? 'bg-gray-700 text-white'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            #{category.name}
          </button>
        );
      })}
    </div>
  );
}
