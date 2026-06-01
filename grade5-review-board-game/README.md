# 🦁 5학년 영어 표현 보드게임 (1~4단원)

천재교육(함순애) 초등 영어 5학년 1~4단원 주요 표현으로 만든 복습 보드게임 웹 앱입니다.
GitHub의 `Lesson.1-4-Review-Board-Game-With-AI` 앱의 기능을 그대로 사용하고,
**단원별 표현과 단어 뜻 사전만 5학년 1~4단원 내용으로 교체**했습니다. (그림은 비우고 이모지로 표시)

## 단원 구성 (각 6문장)

| 단원 | 표현 (의사소통 기능) | 보기 |
|---|---|---|
| 1단원 | **Where are you from?** (출신/국적) | Canada · China · France · India · Korea · Vietnam |
| 2단원 | **What are these/those?** (복수 사물) | forks · maps · scissors · spoons · albums · buttons |
| 3단원 | **Can I ~?** (허락 구하기) | ride a bike · bring animals · take pictures · eat here · sit here · borrow a pen |
| 4단원 | **Whose ~ is this/that?** (소유) | mine · Tom's · Jack's · Eric's · Mike's · Sam's |

## 기술 스택

- React 18 + Vite
- Tailwind CSS

## 실행 방법

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 (dist/)
npm run preview  # 빌드 결과 미리보기
```

## 표현·그림 바꾸는 법

`src/App.jsx` 맨 위 `UNIT_POOLS` 객체만 수정하면 됩니다.
- `question` / `answer`: 학생이 말할 영어 질문·대답
- `emoji`: 카드에 표시할 이모지
- `image`: 그림 파일 경로(`/images/파일명`). 비워두면(`''`) 이모지가 대신 표시됩니다.

단어 클릭 시 뜻을 보여주는 `WORD_MEANING` 사전도 같은 파일에서 수정합니다.

## 별도 저장소(z2x3c4v5/5-1_4-)로 옮기는 법

이 폴더 전체가 독립 실행 가능한 앱입니다. 새 저장소에 올리려면:

```bash
# 이 폴더만 떼어내 새 저장소로 푸시
cp -r grade5-review-board-game /tmp/5-1_4- && cd /tmp/5-1_4-
git init && git add -A && git commit -m "5학년 1~4단원 영어 표현 보드게임"
git branch -M main
git remote add origin https://github.com/z2x3c4v5/5-1_4-.git
git push -u origin main
```
