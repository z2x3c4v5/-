import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { ClipboardCopy, Download, FileText, CheckCircle } from 'lucide-react';

// 'YYYY-MM-DD' 문자열을 로컬 시간 기준 Date로 변환 (timezone에 따른 하루 밀림 방지)
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// XML 특수문자 escape
const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 원본 공문 본문 서식(굴림체 12pt, 양쪽정렬, 공문 표준 내어쓰기)을 적용한
// .odt(OpenDocument Text) 패키지를 생성한다. 본문만 담으므로 한글/에듀파인에
// 붙여넣으면 동일한 글꼴·들여쓰기로 표시된다.
const FONT = '굴림체';

// 미리보기 텍스트를 줄 단위로 분석해 항목 수준(level)에 맞는 단락 스타일을 부여
const buildOdtParagraphs = (text) =>
  text
    .split('\n')
    .map((raw) => {
      const line = raw.trim();
      if (line === '') return '<text:p text:style-name="Body"/>';
      // 가.~하. 등 한글 항목 → 한 단계 들여쓰기(Lv2)
      if (/^[가-힣]\./.test(line)) {
        return `<text:p text:style-name="Lv2">${escapeXml(line)}</text:p>`;
      }
      // 1. 2. / 붙임 / 끝. → 최상위 항목(Lv1)
      if (/^\d+\./.test(line) || /^붙임/.test(line) || /^끝\./.test(line)) {
        return `<text:p text:style-name="Lv1">${escapeXml(line)}</text:p>`;
      }
      return `<text:p text:style-name="Body">${escapeXml(line)}</text:p>`;
    })
    .join('');

const buildContentXml = (text) => {
  const ns =
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
    'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
    'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';
  const textProps =
    `<style:text-properties style:font-name="${FONT}" style:font-name-asian="${FONT}" ` +
    'fo:font-size="12pt" style:font-size-asian="12pt" fo:color="#000000"/>';
  // 공문 표준 내어쓰기: 항목 번호는 내어쓰고 본문은 들여써서 둘째 줄이 정렬됨
  const para = (left, indent) =>
    `<style:paragraph-properties fo:line-height="160%" fo:text-align="justify" ` +
    `fo:margin-left="${left}" fo:text-indent="${indent}" fo:margin-top="0cm" fo:margin-bottom="0cm"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${ns} office:version="1.2">
<office:font-face-decls>
<style:font-face style:name="${FONT}" svg:font-family="${FONT}" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"/>
</office:font-face-decls>
<office:automatic-styles>
<style:style style:name="Body" style:family="paragraph">${para('0cm', '0cm')}${textProps}</style:style>
<style:style style:name="Lv1" style:family="paragraph">${para('0.7cm', '-0.7cm')}${textProps}</style:style>
<style:style style:name="Lv2" style:family="paragraph">${para('1.4cm', '-0.7cm')}${textProps}</style:style>
</office:automatic-styles>
<office:body><office:text>${buildOdtParagraphs(text)}</office:text></office:body>
</office:document-content>`;
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
<office:styles>
<style:default-style style:family="paragraph"><style:text-properties style:font-name="${FONT}" style:font-name-asian="${FONT}" fo:font-size="12pt" style:font-size-asian="12pt"/></style:default-style>
</office:styles>
<office:automatic-styles>
<style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/></style:page-layout>
</office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles>
</office:document-styles>`;

const META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2"><office:meta/></office:document-meta>`;

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

// 본문 텍스트를 받아 완전한 .odt(zip) Blob을 생성
const buildOdtBlob = async (text) => {
  const zip = new JSZip();
  // mimetype은 압축하지 않고 가장 먼저 저장해야 한다 (ODF 규격)
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', MANIFEST_XML);
  zip.file('content.xml', buildContentXml(text));
  zip.file('styles.xml', STYLES_XML);
  zip.file('meta.xml', META_XML);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.oasis.opendocument.text',
  });
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

    const formatDate = (dateStr) => {
      const d = parseLocalDate(dateStr);
      if (!d) return '';
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.(${days[d.getDay()]})`;
    };

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

    const text = `1. 관련: ${refText}
2. 2026학년도 ${eventText} 체험학습을(를) 다음과 같이 실시하고자 합니다.
  가. 일시: ${dateTimeStr}
  나. 장소: ${formData.location || '[장소 입력]'}
  다. 참여 학생: ${participantText}
  라. ‘2026 덕천초 학교 밖 체험학습 안전 계획’에 따라 관련 사전 안전 지도를 ${safetyDateStr}에 실시할 예정임
  마. 당일 세부일정: [붙임] 가정통신문 참고

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
    if (!formData.safetyDate) missing.push('사전 안전 지도 날짜');
    return missing;
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

  // 파일 다운로드 기능 (서식이 적용된 .odt 문서)
  const handleDownload = async () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      showToast(`⚠️ 입력이 비었습니다: ${missing.join(', ')}`);
      return;
    }

    try {
      const blob = await buildOdtBlob(previewText);
      const url = URL.createObjectURL(blob);

      const fileDownload = document.createElement('a');
      document.body.appendChild(fileDownload);
      fileDownload.href = url;
      const gradeFileName =
        formData.grades && formData.grades.length > 0 ? formData.grades.join('_') : 'O';
      fileDownload.download = `[기안문] ${gradeFileName}학년_${formData.eventName || '체험학습'}.odt`;
      fileDownload.click();

      document.body.removeChild(fileDownload);
      URL.revokeObjectURL(url);

      showToast('💾 ODT 문서 다운로드가 시작되었습니다. (한글/LibreOffice에서 열기)');
    } catch (err) {
      showToast('❌ 문서 생성에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <FileText className="text-blue-600" size={32} />
            덕천초 체험학습 기안문 생성기
          </h1>
          <p className="text-slate-500 mt-2">항목을 입력하면 기안문이 자동으로 완성됩니다.</p>
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
                  <option value="학교 밖 체험활동">학교 밖 체험활동</option>
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
                <label className="block text-sm font-bold text-slate-700 mb-1">7. 사전 안전 지도 날짜 (달력 선택)</label>
                <input
                  type="date"
                  name="safetyDate"
                  value={formData.safetyDate}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                />
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
                문서 다운로드
              </button>
            </div>
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
