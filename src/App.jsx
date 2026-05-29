import React, { useState, useEffect } from 'react';
import { ClipboardCopy, Download, FileText, CheckCircle, Mail } from 'lucide-react';
import { buildHwpxBlob } from './hwpx';
import { buildGtongsinBlob } from './gtongsin';

// 'YYYY-MM-DD' 문자열을 로컬 시간 기준 Date로 변환 (timezone에 따른 하루 밀림 방지)
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// 'YYYY-MM-DD' → '2026. 5. 7.(목)' 형태로 변환
const formatDate = (dateStr) => {
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.(${days[d.getDay()]})`;
};

export default function App() {
  const [formData, setFormData] = useState({
    reference: '',
    eventName: '',
    grades: [],
    studentCount: '',
    date: '',
    startTime: '09:00',
    endTime: '12:00',
    location: '',
    transport: '',
    safetyDate: ''
  });

  const [previewText, setPreviewText] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // 폼 데이터가 변경될 때마다 미리보기 텍스트 업데이트
  useEffect(() => {
    const refText = formData.reference || '[관련 선택]';
    const eventText = formData.eventName || '[행사/체험학습명]';
    const gradeText = formData.grades && formData.grades.length > 0 ? formData.grades.join(', ') : '[학년]';
    const countText = formData.studentCount.trim();

    // 참여 학생 표기: 학생 수 칸에 '학년'이 포함되면 학년별 직접 입력으로 보고 그대로 출력,
    // 그렇지 않으면 '대상 학년 + 인원' 형태로 조합한다. (학년 중복 출력 방지)
    let participantText;
    if (!countText) {
      participantText = `${gradeText}학년 [학생 수]`;
    } else if (countText.includes('학년')) {
      participantText = countText;
    } else {
      const countDisplay = countText.includes('명') ? countText : `${countText}명`;
      participantText = `${gradeText}학년 ${countDisplay}`;
    }

    const formatSafetyDate = (dateStr) => {
      const d = parseLocalDate(dateStr);
      if (!d) return '';
      return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    };

    const dateTimeStr = formData.date
      ? `${formatDate(formData.date)} ${formData.startTime}~${formData.endTime}`
      : '[일시 선택]';

    const safetyDateStr = formData.safetyDate
      ? formatSafetyDate(formData.safetyDate)
      : '[날짜 선택]';

    const transportText = formData.transport || '[이동방법 선택]';

    const text = `1. 관련: ${refText}
2. 2026학년도 ${eventText} 체험학습을(를) 다음과 같이 실시하고자 합니다.
  가. 일시: ${dateTimeStr}
  나. 장소: ${formData.location || '[장소 입력]'}
  다. 참여 학생: ${participantText}
  라. 이동방법: ${transportText}
  마. ‘2026 덕천초 학교 밖 체험학습 안전 계획’에 따라 관련 사전 안전 지도를 ${safetyDateStr}에 실시할 예정임
  바. 당일 세부일정: [붙임] 가정통신문 참고

붙임  2026학년도 ${gradeText}학년 ${eventText} 체험학습 가정통신문 1부.
끝.`;
    setPreviewText(text);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGradeToggle = (gradeNum) => {
    setFormData(prev => {
      const currentGrades = prev.grades || [];
      if (currentGrades.includes(gradeNum)) {
        return { ...prev, grades: currentGrades.filter(g => g !== gradeNum) };
      } else {
        return { ...prev, grades: [...currentGrades, gradeNum].sort((a, b) => a - b) };
      }
    });
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // 필수 입력값 검증 (비어 있는 항목 목록 반환)
  const getMissingFields = () => {
    const missing = [];
    if (!formData.reference) missing.push('관련 근거');
    if (!formData.eventName.trim()) missing.push('행사/체험학습명');
    if (formData.grades.length === 0) missing.push('대상 학년');
    if (!formData.studentCount.trim()) missing.push('참여 학생 수');
    if (!formData.date) missing.push('일시');
    if (!formData.location.trim()) missing.push('장소');
    if (!formData.transport) missing.push('이동방법');
    if (!formData.safetyDate) missing.push('사전 안전 지도 날짜');
    return missing;
  };

  // 사전 안전 지도 날짜가 체험학습 일시보다 늦으면(또는 같으면) true
  const isSafetyDateInvalid = () => {
    if (!formData.date || !formData.safetyDate) return false;
    const trip = parseLocalDate(formData.date);
    const safety = parseLocalDate(formData.safetyDate);
    return safety >= trip;
  };

  // 구형 브라우저 폴백용 복사
  const fallbackCopy = () => {
    const textArea = document.createElement('textarea');
    textArea.value = previewText;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(textArea);
    return ok;
  };

  // 클립보드 복사 기능 (Clipboard API 우선, 실패 시 폴백)
  const handleCopy = async () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      showToast(`⚠️ 입력이 비었습니다: ${missing.join(', ')}`);
      return;
    }
    if (isSafetyDateInvalid()) {
      window.alert('사전 안전 지도 계획이 먼저 체험학습 일시보다 앞서야 합니다.');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(previewText);
      } else if (!fallbackCopy()) {
        throw new Error('execCommand copy failed');
      }
      showToast('✅ 기안문 내용이 클립보드에 복사되었습니다! 에듀파인에 붙여넣기 하세요.');
    } catch (err) {
      if (fallbackCopy()) {
        showToast('✅ 기안문 내용이 클립보드에 복사되었습니다! 에듀파인에 붙여넣기 하세요.');
      } else {
        showToast('❌ 복사에 실패했습니다. 미리보기 내용을 직접 선택해 복사해주세요.');
      }
    }
  };

  // 파일 다운로드 기능 (한글 .hwpx 문서)
  const handleDownload = async () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      showToast(`⚠️ 입력이 비었습니다: ${missing.join(', ')}`);
      return;
    }
    if (isSafetyDateInvalid()) {
      window.alert('사전 안전 지도 계획이 먼저 체험학습 일시보다 앞서야 합니다.');
      return;
    }

    try {
      const blob = await buildHwpxBlob(previewText);
      const url = URL.createObjectURL(blob);

      const fileDownload = document.createElement('a');
      document.body.appendChild(fileDownload);
      fileDownload.href = url;
      // 붙임 줄의 문서명과 동일하게: '2026학년도 X학년 OOO 체험학습 가정통신문'
      const gradeText =
        formData.grades && formData.grades.length > 0 ? formData.grades.join(', ') : 'O';
      const eventName = formData.eventName.trim() || '체험학습';
      fileDownload.download = `2026학년도 ${gradeText}학년 ${eventName} 체험학습 가정통신문.hwpx`;
      fileDownload.click();

      document.body.removeChild(fileDownload);
      URL.revokeObjectURL(url);

      showToast('💾 한글(HWPX) 문서 다운로드가 시작되었습니다.');
    } catch (err) {
      showToast('❌ 문서 생성에 실패했습니다.');
    }
  };

  // 가정통신문 다운로드 (행사명·학년·일시·장소를 자동으로 채운 한글 .hwpx)
  const handleGtongsin = async () => {
    // 가정통신문은 입력값이 비어도 자리표시자(○)로 채워 만들 수 있으나,
    // 자동으로 채울 핵심 값(행사명/학년/일시/장소)이 전부 비면 안내한다.
    if (
      !formData.eventName.trim() &&
      formData.grades.length === 0 &&
      !formData.date &&
      !formData.location.trim()
    ) {
      showToast('⚠️ 행사명·학년·일시·장소 중 하나 이상을 먼저 입력해주세요.');
      return;
    }
    if (isSafetyDateInvalid()) {
      window.alert('사전 안전 지도 계획이 먼저 체험학습 일시보다 앞서야 합니다.');
      return;
    }

    try {
      const blob = await buildGtongsinBlob({
        eventName: formData.eventName.trim(),
        grades: formData.grades,
        dateTimeStr: formData.date
          ? `${formatDate(formData.date)} ${formData.startTime}~${formData.endTime}`
          : '',
        location: formData.location.trim(),
        transport: formData.transport,
      });
      const url = URL.createObjectURL(blob);

      const fileDownload = document.createElement('a');
      document.body.appendChild(fileDownload);
      fileDownload.href = url;
      const gradeText =
        formData.grades && formData.grades.length > 0 ? formData.grades.join(', ') : 'O';
      const eventName = formData.eventName.trim() || '체험학습';
      fileDownload.download = `2026학년도 ${gradeText}학년 ${eventName} 체험학습 가정통신문.hwpx`;
      fileDownload.click();

      document.body.removeChild(fileDownload);
      URL.revokeObjectURL(url);

      showToast('💌 가정통신문(HWPX) 다운로드가 시작되었습니다. 비어 있는 부분은 한글에서 채워주세요.');
    } catch (err) {
      showToast('❌ 가정통신문 생성에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <FileText className="text-blue-600" size={32} />
            덕천초등학교 외부체험학습 관련 기안문 생성기
          </h1>
          <p className="text-slate-500 mt-2">항목을 입력하면 기안문이 자동으로 생성됩니다. 복사해서 에듀파인에 붙여넣기 해주세요!</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 왼쪽: 입력 폼 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-6 text-slate-700 border-b pb-2">입력 항목</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">1. 관련 근거 선택</label>
                <select
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">-- 관련 항목을 선택해주세요 --</option>
                  <option value="2026학년도 덕천교육계획">2026학년도 덕천교육계획</option>
                  <option value="2026학년도 덕천초 학교 밖 체험활동">2026학년도 덕천초 학교 밖 체험활동</option>
                  <option value="2026 북부희망교육지구 지원사업">2026 북부희망교육지구 지원사업</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">2. 행사/체험학습명</label>
                <input
                  type="text"
                  name="eventName"
                  value={formData.eventName}
                  onChange={handleChange}
                  placeholder="예: 덕천마을배움터"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">3. 대상 학년 (여러 학년 선택 가능)</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleGradeToggle(num)}
                      className={`flex-1 min-w-[3.5rem] py-2.5 rounded-lg border font-bold transition-all ${
                        formData.grades.includes(num)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-blue-300'
                      }`}
                    >
                      {num}학년
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">4. 참여 학생 수</label>
                <input
                  type="text"
                  name="studentCount"
                  value={formData.studentCount}
                  onChange={handleChange}
                  placeholder="예: 20 (총원) 또는 '1학년 8명, 2학년 12명' (학년별)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  숫자만 입력하면 “{formData.grades.length > 0 ? formData.grades.join(', ') : 'O'}학년 OO명”으로 자동 조합되고,
                  “학년”을 포함해 입력하면 입력한 내용이 그대로 표기됩니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">5. 일시 (날짜 및 시간 선택)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 md:col-span-2">
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      step="600"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                    />
                    <span className="text-slate-500 font-bold">~</span>
                    <input
                      type="time"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleChange}
                      step="600"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">6. 장소</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="예: 대천천환경문화센터 및 대천천 일원"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">7. 이동방법</label>
                <div className="flex flex-wrap gap-2">
                  {['도보', '대중교통', '전세버스'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, transport: opt }))}
                      className={`flex-1 min-w-[5rem] py-2.5 rounded-lg border font-bold transition-all ${
                        formData.transport === opt
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-blue-300'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">8. 사전 안전 지도 날짜 (달력 선택)</label>
                <input
                  type="date"
                  name="safetyDate"
                  value={formData.safetyDate}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                />
                {isSafetyDateInvalid() && (
                  <p className="text-xs text-red-500 mt-1 font-bold">
                    ⚠️ 사전 안전 지도 계획이 먼저 체험학습 일시보다 앞서야 합니다.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 오른쪽: 미리보기 및 액션 */}
          <div className="flex flex-col gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-grow flex flex-col">
              <h2 className="text-xl font-semibold mb-4 text-slate-700 border-b pb-2">실시간 미리보기</h2>

              <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 flex-grow font-serif whitespace-pre-wrap text-slate-800 leading-relaxed overflow-auto shadow-inner text-[15px]">
                {previewText}
              </div>
            </div>

            {/* 버튼 그룹 */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold text-lg shadow-md transition-all active:scale-95"
              >
                <ClipboardCopy size={24} />
                텍스트 복사하기
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold text-lg shadow-md transition-all active:scale-95"
              >
                <Download size={24} />
                기안문 한글파일
              </button>
            </div>

            <button
              onClick={handleGtongsin}
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-xl font-bold text-lg shadow-md transition-all active:scale-95"
            >
              <Mail size={24} />
              가정통신문 한글파일 (입력값 자동 채움)
            </button>
          </div>
        </div>
      </div>

      {/* 토스트 알림 메시지 */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="text-green-400" size={20} />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
