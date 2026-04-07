from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Iterable

from .lexicon import WordItem


@dataclass
class Question:
    id: str
    stem: str
    options: list[str]
    answer_index: int
    level: str | None


def build_quiz(
    *,
    stage: str,
    per_level_count: int,
    items: list[WordItem],
    rng: random.Random,
) -> list[Question]:
    pool = [x for x in items if x.stage == stage]
    if not pool:
        raise ValueError(f"no words for stage={stage}")

    level_map: dict[str, list[WordItem]] = {}
    for it in pool:
        level = it.level or "未知"
        level_map.setdefault(level, []).append(it)

    levels = sort_levels(list(level_map.keys()))
    picked: list[WordItem] = []
    for lv in levels:
        group = level_map[lv]
        rng.shuffle(group)
        picked.extend(group[: min(per_level_count, len(group))])

    if not picked:
        rng.shuffle(pool)
        picked = pool[: min(per_level_count * 6, len(pool))]

    questions: list[Question] = []
    for idx, it in enumerate(picked):
        q = build_mcq(it=it, pool=pool, q_index=idx, rng=rng)
        questions.append(q)
    return questions


def build_mcq(*, it: WordItem, pool: list[WordItem], q_index: int, rng: random.Random) -> Question:
    if it.meaning_zh:
        stem = f"“{it.word}” 的中文意思是？"
        correct = it.meaning_zh
        distractors = pick_distractors_meaning(it=it, pool=pool, rng=rng, k=3)
        options = distractors + [correct]
        rng.shuffle(options)
        answer_index = options.index(correct)
        return Question(
            id=f"q{q_index+1}",
            stem=stem,
            options=options,
            answer_index=answer_index,
            level=it.level,
        )

    stem = f"请选择拼写正确的单词："
    correct = it.word
    distractors = pick_distractors_word(it=it, pool=pool, rng=rng, k=3)
    options = distractors + [correct]
    rng.shuffle(options)
    answer_index = options.index(correct)
    return Question(
        id=f"q{q_index+1}",
        stem=stem,
        options=options,
        answer_index=answer_index,
        level=it.level,
    )


def pick_distractors_meaning(*, it: WordItem, pool: list[WordItem], rng: random.Random, k: int) -> list[str]:
    cand = [x for x in pool if x.word.lower() != it.word.lower() and x.meaning_zh]
    same_pos = [x for x in cand if it.pos and x.pos == it.pos]
    out: list[str] = []
    rng.shuffle(same_pos)
    for x in same_pos:
        if x.meaning_zh and x.meaning_zh not in out:
            out.append(x.meaning_zh)
        if len(out) >= k:
            return out
    rng.shuffle(cand)
    for x in cand:
        if x.meaning_zh and x.meaning_zh not in out:
            out.append(x.meaning_zh)
        if len(out) >= k:
            return out
    return out


def pick_distractors_word(*, it: WordItem, pool: list[WordItem], rng: random.Random, k: int) -> list[str]:
    cand = [x for x in pool if x.word.lower() != it.word.lower()]
    same_len = [x for x in cand if abs(len(x.word) - len(it.word)) <= 2]
    same_pos = [x for x in cand if it.pos and x.pos == it.pos]
    merged = list(dict.fromkeys([*same_pos, *same_len, *cand]))
    rng.shuffle(merged)
    out: list[str] = []
    for x in merged:
        if x.word not in out:
            out.append(x.word)
        if len(out) >= k:
            break
    while len(out) < k:
        out.append(mutate_word(it.word, rng=rng))
    return out[:k]


def mutate_word(word: str, rng: random.Random) -> str:
    if len(word) <= 3:
        return word + rng.choice(["e", "a", "o"])
    i = rng.randrange(1, len(word) - 1)
    s = list(word)
    if rng.random() < 0.5:
        s[i], s[i + 1] = s[i + 1], s[i]
    else:
        s[i] = rng.choice("abcdefghijklmnopqrstuvwxyz")
    return "".join(s)


def sort_levels(levels: list[str]) -> list[str]:
    def key(lv: str) -> tuple[int, int, str]:
        s = lv.strip()
        stage_rank = 9
        if s.startswith("小学"):
            stage_rank = 1
        elif s.startswith("初中"):
            stage_rank = 2
        elif s.startswith("高中"):
            stage_rank = 3
        num = 999
        for token in s.split():
            if token.endswith("级"):
                t = token[:-1]
                if t.isdigit():
                    num = int(t)
        return (stage_rank, num, s)

    return sorted(levels, key=key)


def summarize_by_level(questions: list[Question], answers: list[int]) -> list[dict]:
    m: dict[str, dict[str, int]] = {}
    for i, q in enumerate(questions):
        level = q.level or "未知"
        v = m.setdefault(level, {"total": 0, "correct": 0})
        v["total"] += 1
        if i < len(answers) and answers[i] == q.answer_index:
            v["correct"] += 1
    return [{"level": k, "total": v["total"], "correct": v["correct"]} for k, v in m.items()]


def pick_one(it: Iterable[WordItem]) -> WordItem | None:
    for x in it:
        return x
    return None

