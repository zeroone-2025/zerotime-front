'use client';

import { useState, useEffect, useRef } from 'react';

import { FiBookmark, FiInfo, FiRotateCcw, FiSave, FiSearch, FiTrash2, FiX } from 'react-icons/fi';

import Button from '@/_components/ui/Button';
import Toast from '@/_components/ui/Toast';
import {
  BoardGroup,
  deleteMyBoardGroup,
  getMyBoardGroups,
  upsertMyBoardGroup,
  readBoardGroupsCache,
  writeBoardGroupsCache,
} from '@/_lib/api';
import type { BoardCategory, BoardInfo } from '@/_lib/api/boards';
import { CATEGORY_ORDER, getDefaultBoardCodes } from '@/_lib/constants/boards';
import { useBoardsBySchool } from '@/_lib/hooks/useBoards';
import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';
import { useUser } from '@/_lib/hooks/useUser';

interface BoardFilterContentProps {
  selectedBoards: string[];
  onApply: (boards: string[]) => void;
  onClose: () => void;
}

const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const normalizeSearchText = (text: string) => text.toLowerCase().replace(/\s+/g, '');

const getChoseong = (text: string) => {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) {
      result += char;
      continue;
    }
    const index = Math.floor((code - 0xac00) / 588);
    result += CHOSEONG[index] || '';
  }
  return result;
};

export default function BoardFilterContent({
  selectedBoards,
  onApply,
  onClose,
}: BoardFilterContentProps) {
  const [tempSelection, setTempSelection] = useState<Set<string>>(new Set());
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isSavePanelOpen, setIsSavePanelOpen] = useState(false);
  const [isGroupListExpanded, setIsGroupListExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [toastKey, setToastKey] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isLoggedIn, isAuthLoaded, user } = useUser();
  const isGuest = !isLoggedIn;
  const { guestSchool } = useGuestSchool();
  const school = user?.school || guestSchool;
  const { data: boardList = [], isLoading: isBoardsLoading } = useBoardsBySchool(school);

  // 초기화
  useEffect(() => {
    if (!isAuthLoaded) return;

    setTempSelection(new Set(selectedBoards));
  }, [selectedBoards, isAuthLoaded]);

  // 저장한 그룹 로드 (로그인 사용자만)
  useEffect(() => {
    if (!isAuthLoaded) return;
    if (!isLoggedIn) {
      setBoardGroups([]);
      return;
    }
    if (!user?.email) return;

    const load = async () => {
      const cachedGroups = readBoardGroupsCache(user.email);
      if (cachedGroups.length > 0) {
        setBoardGroups(cachedGroups);
      }

      try {
        const groups = await getMyBoardGroups();
        setBoardGroups(groups);
        writeBoardGroupsCache(user.email, groups);
      } catch {
        if (cachedGroups.length === 0) {
          setBoardGroups([]);
        }
      }
    };
    load();
  }, [isAuthLoaded, isLoggedIn, user?.email]);

  const normalizedQuery = normalizeSearchText(searchQuery);
  const matchesSearch = (board: BoardInfo) => {
    if (!normalizedQuery) return true;

    const name = normalizeSearchText(board.name);
    const id = normalizeSearchText(board.board_code);
    const category = normalizeSearchText(board.category);
    const choseong = normalizeSearchText(getChoseong(board.name));

    return (
      name.includes(normalizedQuery) ||
      id.includes(normalizedQuery) ||
      category.includes(normalizedQuery) ||
      choseong.includes(normalizedQuery)
    );
  };

  // 선택된 게시판은 검색과 무관하게 항상 표시
  const selectedItems = boardList.filter((board) => tempSelection.has(board.board_code));
  // 미선택 게시판 목록에만 검색 적용
  const unselectedItems = boardList.filter(
    (board) => !tempSelection.has(board.board_code) && matchesSearch(board)
  );

  // 카테고리별로 미선택 게시판 그룹화
  const groupedUnselected: Record<BoardCategory, BoardInfo[]> = {
    본부: [],
    단과대: [],
    학과: [],
    사업단: [],
  };

  unselectedItems.forEach((board) => {
    groupedUnselected[board.category].push(board);
  });

  // 선택/해제 토글
  const toggleBoard = (boardId: string) => {
    setTempSelection((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(boardId)) {
        newSet.delete(boardId);
      } else {
        newSet.add(boardId);
      }
      return newSet;
    });
  };

  // 초기화하기
  const handleReset = () => {
    if (isGuest) {
      setTempSelection(new Set(getDefaultBoardCodes(boardList)));
    } else {
      setTempSelection(new Set());
    }
  };

  const handleApply = () => {
    onApply(Array.from(tempSelection));
  };

  const handleSaveCurrentGroup = async () => {
    if (isGuest) {
      showInfoToast('저장한 그룹 기능은 로그인 후 사용할 수 있어요.');
      return;
    }

    const selected = Array.from(tempSelection);
    if (selected.length === 0) {
      alert('선택된 게시판이 없어 저장할 수 없습니다.');
      return;
    }

    const candidateName = groupName.trim() || `그룹 ${boardGroups.length + 1}`;
    try {
      await upsertMyBoardGroup({
        name: candidateName,
        board_codes: selected,
      });
      const groups = await getMyBoardGroups();
      setBoardGroups(groups);
      if (user?.email) {
        writeBoardGroupsCache(user.email, groups);
      }
      setGroupName('');
      setIsSavePanelOpen(false);
      showInfoToast('현재 선택을 저장했어요.');
    } catch (e) {
      showInfoToast('그룹 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleApplyBoardGroup = (group: BoardGroup) => {
    setTempSelection(new Set(group.board_codes));
  };

  const handleDeleteBoardGroup = async (groupId: number) => {
    try {
      await deleteMyBoardGroup(groupId);
      setBoardGroups((prev) => {
        const next = prev.filter((group) => group.id !== groupId);
        if (user?.email) {
          writeBoardGroupsCache(user.email, next);
        }
        return next;
      });
    } catch {
      showInfoToast('그룹 삭제에 실패했습니다.');
    }
  };

  const isSameAsTempSelection = (group: BoardGroup) => {
    if (group.board_codes.length !== tempSelection.size) return false;
    return group.board_codes.every((boardId) => tempSelection.has(boardId));
  };

  const VISIBLE_GROUP_COUNT = 0;
  const visibleGroups = isGroupListExpanded
    ? boardGroups
    : boardGroups.slice(0, VISIBLE_GROUP_COUNT);
  const hiddenGroupCount = Math.max(0, boardGroups.length - VISIBLE_GROUP_COUNT);

  const showInfoToast = (message: string) => {
    setToastMessage(message);
    setToastType('info');
    setToastKey((prev) => prev + 1);
    setShowToast(true);
  };

  const handleOpenSavePanel = () => {
    if (isGuest) {
      showInfoToast('저장한 그룹 기능은 로그인 후 사용할 수 있어요.');
      return;
    }
    if (tempSelection.size === 0) {
      showInfoToast('선택된 게시판이 없어 추가할 수 없습니다.');
      return;
    }
    setIsSavePanelOpen((prev) => !prev);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Body - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Zone A: 선택된 게시판 */}
        <div className="border-b border-gray-100 bg-blue-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500">선택된 게시판</h3>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              aria-label="초기화"
            >
              <FiRotateCcw size={16} />
              <span>초기화</span>
            </button>
          </div>
          {selectedItems.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">
              보고 싶은 게시판을 선택해주세요
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedItems.map((board) => (
                <button
                  key={board.board_code}
                  onClick={() => toggleBoard(board.board_code)}
                  className="rounded-full border-2 border-gray-900 bg-white px-4 py-2 text-sm font-bold text-gray-900 shadow-md transition-all hover:bg-gray-50 active:scale-95"
                >
                  {board.name}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Zone B: 저장한 그룹 */}
        <div className="border-b border-gray-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiBookmark size={14} className="text-blue-600" />
              <h3 className="text-xs font-bold text-gray-500">저장한 그룹</h3>
              <span className="text-[10px] text-gray-400">최대 10개</span>
            </div>
            <button
              onClick={handleOpenSavePanel}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              + 현재 선택 저장
            </button>
          </div>

          {isSavePanelOpen && (
            <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/60 p-2">
              <div className="flex gap-2">
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="그룹 이름 (예: 기본, 학과탐색)"
                  className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-400"
                />
                <button
                  onClick={handleSaveCurrentGroup}
                  disabled={tempSelection.size === 0}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                >
                  <FiSave size={14} />
                  저장
                </button>
                <button
                  onClick={() => setIsSavePanelOpen(false)}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 transition-colors hover:bg-gray-100"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {!isLoggedIn && (
            <p className="mb-3 text-xs text-gray-400">
              로그인하면 자주 쓰는 게시판 조합을 저장하고 빠르게 복원할 수 있어요.
            </p>
          )}

          {boardGroups.length === 0 ? (
            <p className="text-xs text-gray-400">저장된 그룹이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              <div className={`${isGroupListExpanded ? 'max-h-52 overflow-y-auto pr-1' : ''} space-y-2`}>
                {visibleGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`flex items-center gap-2 rounded-lg border p-2 ${
                      isSameAsTempSelection(group)
                        ? 'border-blue-200 bg-blue-50/60'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-800">{group.name}</div>
                      <div className="text-[11px] text-gray-400">{group.board_codes.length}개 게시판</div>
                    </div>
                  <button
                    onClick={() => handleApplyBoardGroup(group)}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    불러오기
                  </button>
                  <button
                    onClick={() => handleDeleteBoardGroup(group.id)}
                    className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label={`${group.name} 삭제`}
                  >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {hiddenGroupCount > 0 && !isGroupListExpanded && (
                <button
                  onClick={() => setIsGroupListExpanded(true)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  저장한 그룹 보기 ({boardGroups.length}개)
                </button>
              )}

              {isGroupListExpanded && boardGroups.length > VISIBLE_GROUP_COUNT && (
                <button
                  onClick={() => setIsGroupListExpanded(false)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  접기
                </button>
              )}
            </div>
          )}
        </div>

        {/* Zone C: 전체 목록 */}
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-gray-500">전체 목록</h3>
            <div className="relative w-[140px]">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="게시판 검색"
                className="h-8 w-full rounded-lg border border-gray-200 bg-white px-3 pr-14 text-xs outline-none transition-colors focus:border-blue-400"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label="검색어 지우기"
                >
                  <FiX size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="게시판 검색"
              >
                <FiSearch size={13} />
              </button>
            </div>
          </div>
          {isBoardsLoading && (
            <p className="py-6 text-center text-sm text-gray-400">게시판 목록을 불러오는 중...</p>
          )}
          <div className="flex flex-col gap-6">
            {!isBoardsLoading && CATEGORY_ORDER.map((category) => {
              const unselectedBoards = groupedUnselected[category];
              const allBoardsInCategory = boardList.filter((b) => b.category === category);

              return (
                <div key={category}>
                  <h4 className="mb-3 text-xs font-bold text-gray-400">{category}</h4>
                  {unselectedBoards.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {unselectedBoards.map((board) => (
                        <button
                          key={board.board_code}
                          onClick={() => toggleBoard(board.board_code)}
                          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100 active:scale-95"
                        >
                          {board.name}
                        </button>
                      ))}
                    </div>
                  ) : allBoardsInCategory.length > 0 ? (
                    <div className="h-3"></div>
                  ) : null}
                </div>
              );
            })}
            {unselectedItems.length === 0 && normalizedQuery && (
              <p className="py-6 text-center text-sm text-gray-400">
                검색 결과가 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-100">
        {/* Guest 안내 문구 */}
        {!isLoggedIn && (
          <div className="flex items-start gap-2 bg-blue-50 px-5 py-3">
            <FiInfo className="mt-0.5 shrink-0 text-blue-600" size={16} />
            <p className="text-xs text-gray-600">
              로그인하지 않으면 설정이 다른 기기에서 저장되지 않습니다.
            </p>
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="flex gap-3 px-5 py-4 pb-safe">
          <Button variant="outline" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" fullWidth onClick={handleApply}>
            적용하기
          </Button>
        </div>
      </div>

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        triggerKey={toastKey}
      />
    </div>
  );
}
