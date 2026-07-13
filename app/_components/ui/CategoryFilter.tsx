import { useState, useEffect } from 'react';
import { FiSliders, FiX, FiSearch } from 'react-icons/fi';

interface CategoryFilterProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  isLoggedIn: boolean; // 로그인 상태
  onSettingsClick: () => void; // 설정 버튼 클릭 콜백
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void; // 토스트 메시지 표시
  searchValue: string; // 검색어 입력값
  onSearchChange: (value: string) => void; // 검색어 변경 콜백
}

// 전체 필터 목록 (Guest/User 공통)
const ALL_FILTERS = [
  { key: 'ALL', label: '전체' },
  { key: 'UNREAD', label: '안 읽음' },
  { key: 'KEYWORD', label: '키워드' },
  { key: 'FAVORITE', label: '즐겨찾기' },
];

// 로그인 필요 필터 목록
const LOGIN_REQUIRED_FILTERS = ['UNREAD', 'KEYWORD', 'FAVORITE'];

export default function CategoryFilter({ activeFilter, onFilterChange, isLoggedIn, onSettingsClick, onShowToast, searchValue, onSearchChange }: CategoryFilterProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // 첫 방문 여부 확인 (localStorage)
    const hasSeenTooltip = localStorage.getItem('hasSeenFilterTooltip');
    if (!hasSeenTooltip) {
      setShowTooltip(true);
    }
  }, []);

  const handleSettingsClick = () => {
    // 툴팁 닫기 및 다시 보지 않음 설정
    if (showTooltip) {
      setShowTooltip(false);
      localStorage.setItem('hasSeenFilterTooltip', 'true');
    }
    onSettingsClick();
  };

  const closeTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(false);
    localStorage.setItem('hasSeenFilterTooltip', 'true');
  };

  const handleFilterClick = (filterKey: string) => {
    // 비로그인 사용자가 제한된 필터를 클릭하면 로그인 유도
    if (!isLoggedIn && LOGIN_REQUIRED_FILTERS.includes(filterKey)) {
      onShowToast('로그인 후 사용할 수 있는 기능입니다.', 'info');
      return;
    }
    // 허용된 필터 또는 로그인 사용자: 필터 변경
    onFilterChange(filterKey);
  };

  return (
    <div className="relative flex w-full flex-col gap-2 bg-gray-50 px-4 py-2 md:flex-row md:items-center">
      {/* 설정 버튼 + 필터 칩 (항상 한 줄 유지) */}
      <div className="flex items-center gap-2 md:min-w-0 md:flex-1">
      {/* 좌측 고정 설정 버튼 */}
      <div className="relative shrink-0 flex items-center gap-2">
        <button
          onClick={handleSettingsClick}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white p-1.5 text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-95"
          aria-label="필터 설정"
        >
          <FiSliders size={18} className="text-gray-600" />
        </button>
      </div>

      {/* 필터 칩 목록 (가로 스크롤 가능) */}
      <div className="flex flex-1 overflow-x-auto no-scrollbar justify-start gap-2 py-0.5">
        {ALL_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;

           return (
             <button
               key={filter.key}
               onClick={() => handleFilterClick(filter.key)}
               className={`relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95 ${isActive
                 ? 'bg-gray-900 text-white shadow-md'
                 : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                 }`}
              >
                {filter.label}
              </button>
           );
        })}
        </div>
      </div>

      {/* 검색창: 휴대폰=필터 아랫줄(전체 폭), 태블릿·노트북(md 832px↑)=같은 줄 오른쪽.
          md:mr-1(4px)로 오른쪽 끝을 공지 카드 목록(NoticeList의 md:p-5=20px)과 정렬 —
          이 바는 px-4(16px)라 그대로 두면 검색창이 4px 더 튀어나온다. */}
      <div className="relative w-full md:mr-1 md:w-64 md:shrink-0">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="공지 제목 검색"
          aria-label="공지 제목 검색"
          className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:border-gray-400 focus:outline-none"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600"
            aria-label="검색어 지우기"
          >
            <FiX size={16} />
          </button>
        )}
      </div>

      {/* 툴팁: 바 전체 아래 여백에 띄운다 — 모바일에서 아랫줄로 내려온 검색창을 가리지 않게
          (설정 버튼 기준이 아니라 컨테이너 기준. 화살표는 좌상단 설정 버튼을 향한다) */}
      {showTooltip && (
        <div className="absolute top-full left-4 z-10 mt-1 animate-fadeIn">
          <div className="relative flex items-center gap-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
            <span>내 학과를 선택하고 더 많은 정보를 확인하세요</span>
            <button
              onClick={closeTooltip}
              className="rounded-full p-0.5 hover:bg-gray-700"
            >
              <FiX size={12} />
            </button>
            {/* 툴팁 화살표 (위쪽 설정 버튼으로 향함) */}
            <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}
