'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiClipboard, FiUsers } from 'react-icons/fi';

import FullPageModal from '@/_components/layout/FullPageModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';
import { useGroups, useParseGroups, useSaveGroups, useGroupSets, useCreateGroupSet } from '@/_lib/hooks/useGroups';
import type { GroupInput, GroupParseResponse, GroupSet } from '@/_types/team';

import GroupCurrentView from './groups/GroupCurrentView';
import GroupTextInput from './groups/GroupTextInput';
import GroupParsePreview from './groups/GroupParsePreview';
import GroupInlineEditor from './groups/GroupInlineEditor';

type Step = 'current' | 'set-select' | 'method' | 'compose' | 'input' | 'preview' | 'edit';

export default function GroupManageView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = Number(searchParams.get('id'));
  const goBack = useSmartBack(`/chinba/team/detail?id=${teamId}&tab=mannaja`);

  const { data: groupsData, isLoading } = useGroups(teamId);
  const { data: groupSetsData, isLoading: setsLoading } = useGroupSets(teamId);
  const parseGroups = useParseGroups(teamId);
  const saveGroups = useSaveGroups(teamId);
  const createGroupSet = useCreateGroupSet(teamId);

  const hasExistingGroups = (groupsData?.groups ?? []).length > 0;
  const groupSets = groupSetsData?.group_sets ?? [];

  const [step, setStep] = useState<Step | null>(null);
  const [parseResult, setParseResult] = useState<GroupParseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupSetId, setSelectedGroupSetId] = useState<number | null>(null);
  const [newSetName, setNewSetName] = useState('');

  const initialMode = searchParams.get('mode');
  const initialSetId = searchParams.get('setId');

  // 데이터 로딩 완료 후 초기 step 결정
  useEffect(() => {
    if (!isLoading && !setsLoading && step === null) {
      if (initialMode === 'edit' && hasExistingGroups) {
        setSelectedGroupSetId(initialSetId ? Number(initialSetId) : null);
        setStep('edit');
      } else if (initialMode === 'recompose' && initialSetId) {
        setSelectedGroupSetId(Number(initialSetId));
        setStep('method');
      } else {
        setStep(hasExistingGroups ? 'current' : 'set-select');
      }
    }
  }, [isLoading, setsLoading, hasExistingGroups, step, initialMode, initialSetId]);

  const handleSetSelect = async () => {
    setError(null);
    if (!selectedGroupSetId && !newSetName.trim()) {
      setError('그룹세트를 선택하거나 새 이름을 입력해주세요.');
      return;
    }

    if (!selectedGroupSetId && newSetName.trim()) {
      try {
        const created = await createGroupSet.mutateAsync({ name: newSetName.trim() });
        setSelectedGroupSetId(created.id);
        setStep('method');
      } catch (err: any) {
        setError(err.response?.data?.detail || '그룹세트 생성에 실패했습니다.');
      }
      return;
    }

    setStep('method');
  };

  const handleParse = async (text: string) => {
    setError(null);
    try {
      const result = await parseGroups.mutateAsync({ text, group_set_id: selectedGroupSetId ?? undefined });
      setParseResult(result);
      setStep('preview');
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setError('로그인이 필요하거나 권한이 없습니다.');
      } else if (err.code === 'ECONNABORTED') {
        setError('AI 분석 시간이 초과되었습니다. 텍스트를 줄여서 다시 시도해주세요.');
      } else {
        setError(err.response?.data?.detail || '조 편성 분석에 실패했습니다. 텍스트 형식을 확인해주세요.');
      }
    }
  };

  const handleConfirm = async (groups: GroupInput[]) => {
    setError(null);
    try {
      await saveGroups.mutateAsync({ groups, group_set_id: selectedGroupSetId ?? undefined });
      router.replace(`/chinba/team/detail?id=${teamId}&tab=mannaja`);
    } catch (err: any) {
      setError(err.response?.data?.detail || '조 편성 저장에 실패했습니다.');
    }
  };

  if (isLoading || setsLoading) {
    return (
      <FullPageModal isOpen={true} onClose={goBack} title="조 편성">
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      </FullPageModal>
    );
  }

  return (
    <FullPageModal isOpen={true} onClose={goBack} title="조 편성">
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
      {step === 'current' && (
        <GroupCurrentView
          teamId={teamId}
          groupSets={groupSets}
          onRecompose={(setId?: number) => {
            setSelectedGroupSetId(setId ?? null);
            setStep(setId ? 'method' : 'set-select');
          }}
          onEdit={(setId?: number) => {
            setSelectedGroupSetId(setId ?? null);
            setStep('edit');
          }}
        />
      )}
      {step === 'set-select' && (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">그룹세트 선택</h3>
            <p className="text-xs text-gray-500">조를 편성할 활동을 선택하거나 새로 만드세요.</p>

            {/* 기존 세트 목록 */}
            {groupSets.map((gs) => (
              <button
                key={gs.id}
                onClick={() => {
                  setSelectedGroupSetId(gs.id);
                  setNewSetName('');
                }}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${
                  selectedGroupSetId === gs.id
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{gs.name}</span>
                  <span className="text-xs text-gray-400">{gs.group_count}개 조</span>
                </div>
              </button>
            ))}

            {/* 새 세트 입력 */}
            <div className={`rounded-xl border p-4 space-y-2 ${
              !selectedGroupSetId && newSetName ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
            }`}>
              <label className="text-xs font-medium text-gray-600">새 그룹세트</label>
              <input
                type="text"
                placeholder="예: 친바, 스터디, 프로젝트"
                value={newSetName}
                onChange={(e) => {
                  setNewSetName(e.target.value);
                  if (e.target.value) setSelectedGroupSetId(null);
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                maxLength={30}
              />
            </div>
          </div>

          <div className="shrink-0 px-4 py-3 pb-safe border-t border-gray-100">
            <button
              onClick={handleSetSelect}
              disabled={!selectedGroupSetId && !newSetName.trim()}
              className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {createGroupSet.isPending ? '생성 중...' : '다음'}
            </button>
          </div>
        </div>
      )}
      {step === 'method' && (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800">편성 방식 선택</h3>
              <p className="text-xs text-gray-500 mt-0.5">조를 어떻게 만들지 고르세요.</p>
            </div>

            <button
              onClick={() => { setError(null); setStep('compose'); }}
              className="w-full text-left rounded-xl border border-gray-200 p-4 transition-colors hover:border-gray-300 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <FiUsers size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-800">직접 선택하기</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">멤버를 눌러 조에 배정합니다</p>
            </button>

            <button
              onClick={() => { setError(null); setStep('input'); }}
              className="w-full text-left rounded-xl border border-gray-200 p-4 transition-colors hover:border-gray-300 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <FiClipboard size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-800">텍스트 붙여넣기 (AI)</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">엑셀·카톡 명단을 붙여넣어 자동 분석합니다</p>
            </button>
          </div>

          <div className="shrink-0 px-4 py-3 pb-safe border-t border-gray-100">
            <button
              onClick={() => { setError(null); setStep(hasExistingGroups ? 'current' : 'set-select'); }}
              className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              돌아가기
            </button>
          </div>
        </div>
      )}
      {step === 'compose' && (
        <GroupInlineEditor
          teamId={teamId}
          groupSetId={selectedGroupSetId ?? undefined}
          mode="compose"
          onSave={handleConfirm}
          onBack={() => { setError(null); setStep('method'); }}
          isSaving={saveGroups.isPending}
        />
      )}
      {step === 'input' && (
        <GroupTextInput
          onParse={handleParse}
          isParsing={parseGroups.isPending}
          onBack={() => { setError(null); setStep('method'); }}
        />
      )}
      {step === 'preview' && parseResult && (
        <GroupParsePreview
          parsedGroups={parseResult.parsed_groups}
          unmatchedNames={parseResult.unmatched_names}
          unassignedMembers={parseResult.unassigned_members}
          onConfirm={handleConfirm}
          onBack={() => { setError(null); setStep('input'); }}
          isSaving={saveGroups.isPending}
        />
      )}
      {step === 'edit' && (
        <GroupInlineEditor
          teamId={teamId}
          groupSetId={selectedGroupSetId ?? undefined}
          onSave={handleConfirm}
          onBack={() => { setError(null); setStep('current'); }}
          isSaving={saveGroups.isPending}
        />
      )}
    </FullPageModal>
  );
}
