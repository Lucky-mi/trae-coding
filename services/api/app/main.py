from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .assessment import Question, build_quiz, summarize_by_level
from .lexicon import load_lexicon
from .schemas import (
    AnswerIn,
    AnswerOut,
    AssessmentResultOut,
    AssessmentStartIn,
    AssessmentStartOut,
    QuestionOut,
    ResultLevelOut,
)


@dataclass
class Session:
    stage: str
    questions: list[Question]
    answers: list[int]
    ended_by: str


app = FastAPI(title="WordGauge API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_rng = random.Random(7)
_sessions: dict[str, Session] = {}
_lexicon_items = []


@app.on_event("startup")
def _startup() -> None:
    global _lexicon_items
    project_root = Path(__file__).resolve().parents[3]
    _lexicon_items = load_lexicon(project_root)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "words": len(_lexicon_items)}


@app.post("/api/assessments/start", response_model=AssessmentStartOut)
def start_assessment(body: AssessmentStartIn) -> AssessmentStartOut:
    try:
        questions = build_quiz(
            stage=body.stage,
            per_level_count=body.per_level_count,
            items=_lexicon_items,
            rng=_rng,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    session_id = f"s{len(_sessions) + 1}"
    _sessions[session_id] = Session(
        stage=body.stage,
        questions=questions,
        answers=[],
        ended_by="quota",
    )

    return AssessmentStartOut(
        session_id=session_id,
        question=to_question_out(questions[0]),
        total=len(questions),
    )


@app.post("/api/assessments/{session_id}/answer", response_model=AnswerOut)
def answer(session_id: str, body: AnswerIn) -> AnswerOut:
    s = _sessions.get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="session not found")
    idx = len(s.answers)
    if idx >= len(s.questions):
        return AnswerOut(done=True, question=None, progress=len(s.answers), total=len(s.questions))

    q = s.questions[idx]
    if q.id != body.question_id:
        raise HTTPException(status_code=400, detail="question mismatch")
    if body.choice_index >= len(q.options):
        raise HTTPException(status_code=400, detail="choice_index out of range")

    s.answers.append(body.choice_index)
    idx2 = len(s.answers)
    if idx2 >= len(s.questions):
        return AnswerOut(done=True, question=None, progress=idx2, total=len(s.questions))
    return AnswerOut(
        done=False,
        question=to_question_out(s.questions[idx2]),
        progress=idx2,
        total=len(s.questions),
    )


@app.get("/api/assessments/{session_id}/result", response_model=AssessmentResultOut)
def result(session_id: str) -> AssessmentResultOut:
    s = _sessions.get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="session not found")

    correct = 0
    for i, a in enumerate(s.answers):
        if i >= len(s.questions):
            break
        if a == s.questions[i].answer_index:
            correct += 1
    by_level = summarize_by_level(s.questions, s.answers)

    return AssessmentResultOut(
        session_id=session_id,
        stage=s.stage,
        total=len(s.questions),
        completed=len(s.answers),
        correct=correct,
        ended_by=s.ended_by,
        by_level=[ResultLevelOut(**x) for x in by_level],
    )


def to_question_out(q: Question) -> QuestionOut:
    return QuestionOut(id=q.id, stem=q.stem, options=q.options, level=q.level)

