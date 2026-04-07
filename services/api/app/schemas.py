from __future__ import annotations

from pydantic import BaseModel, Field


class AssessmentStartIn(BaseModel):
    stage: str = Field(min_length=1)
    per_level_count: int = Field(default=4, ge=1, le=50)
    adaptive: bool = True
    time_limit_sec: int | None = Field(default=None, ge=10, le=60 * 60)


class QuestionOut(BaseModel):
    id: str
    stem: str
    options: list[str]
    level: str | None = None
    kind: str = "mcq"


class AssessmentStartOut(BaseModel):
    session_id: str
    question: QuestionOut
    total: int


class AnswerIn(BaseModel):
    question_id: str = Field(min_length=1)
    choice_index: int = Field(ge=0)


class AnswerOut(BaseModel):
    done: bool
    question: QuestionOut | None = None
    progress: int
    total: int


class ResultLevelOut(BaseModel):
    level: str
    total: int
    correct: int


class AssessmentResultOut(BaseModel):
    session_id: str
    stage: str
    total: int
    completed: int
    correct: int
    ended_by: str
    by_level: list[ResultLevelOut]

