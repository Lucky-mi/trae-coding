from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass(frozen=True)
class WordItem:
    word: str
    meaning_zh: str | None
    stage: str
    level: str | None
    pos: str | None


def default_xlsx_paths(project_root: Path) -> list[Path]:
    return [
        project_root / "京师小学考纲.xlsx",
        project_root / "京师初中考纲（不含小学）.xlsx",
        project_root / "京师高中考纲（不含初中）.xlsx",
    ]


def load_lexicon(project_root: Path) -> list[WordItem]:
    items: list[WordItem] = []
    for p in default_xlsx_paths(project_root):
        if not p.exists():
            continue
        stage = infer_stage_from_filename(p.name)
        items.extend(load_xlsx(p, stage))
    return dedup_items(items)


def infer_stage_from_filename(name: str) -> str:
    if "小学" in name:
        return "小学"
    if "初中" in name:
        return "初中"
    if "高中" in name:
        return "高中"
    return "未知"


def load_xlsx(path: Path, stage: str) -> list[WordItem]:
    sheets: dict[str, Any] = pd.read_excel(path, sheet_name=None)
    out: list[WordItem] = []
    for _, df in sheets.items():
        if df is None or df.empty:
            continue
        df = normalize_columns(df)
        col_word = pick_col(df.columns, ["word", "单词", "词汇", "英文"])
        if not col_word:
            continue
        col_meaning = pick_col(df.columns, ["meaning_zh", "中文", "释义", "中文释义", "翻译", "意义"])
        col_level = pick_col(df.columns, ["level", "级", "等级", "层级"])
        col_pos = pick_col(df.columns, ["pos", "词性"])

        for _, row in df.iterrows():
            w = as_str(row.get(col_word))
            if not w:
                continue
            w = clean_word(w)
            meaning = as_str(row.get(col_meaning)) if col_meaning else None
            level = as_str(row.get(col_level)) if col_level else None
            pos = as_str(row.get(col_pos)) if col_pos else None
            out.append(
                WordItem(
                    word=w,
                    meaning_zh=meaning or None,
                    stage=stage,
                    level=normalize_level(level) if level else None,
                    pos=normalize_pos(pos) if pos else None,
                )
            )
    return out


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    def n(s: Any) -> str:
        v = as_str(s)
        v = v.replace("\n", "").replace("\r", "").strip()
        v = re.sub(r"\s+", "", v)
        return v

    df = df.copy()
    df.columns = [n(c) for c in df.columns]
    return df


def pick_col(cols: list[str], candidates: list[str]) -> str | None:
    for c in candidates:
        if c in cols:
            return c
    for c in cols:
        for k in candidates:
            if k in c:
                return c
    return None


def as_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    s = str(v).strip()
    if s.lower() in {"nan", "none", "null"}:
        return ""
    return s


_word_re = re.compile(r"[A-Za-z][A-Za-z\\-']*")


def clean_word(v: str) -> str:
    m = _word_re.search(v)
    if not m:
        return v.strip()
    return m.group(0).strip()


def normalize_level(v: str) -> str:
    s = v.strip()
    if not s:
        return s
    s = s.replace("级别", "级").replace("等级", "级")
    m = re.search(r"(小学|初中|高中)?\\s*(\\d+)\\s*级", s)
    if m:
        n = int(m.group(2))
        prefix = m.group(1)
        if prefix:
            return f"{prefix} {n}级"
        return f"{n}级"
    m2 = re.search(r"(\\d+)", s)
    if m2:
        return f"{int(m2.group(1))}级"
    return s


def normalize_pos(v: str) -> str:
    s = v.strip().lower()
    s = s.replace("名词", "n").replace("动词", "v").replace("形容词", "adj").replace("副词", "adv")
    return s


def dedup_items(items: list[WordItem]) -> list[WordItem]:
    seen: set[tuple[str, str]] = set()
    out: list[WordItem] = []
    for it in items:
        k = (it.stage, it.word.lower())
        if k in seen:
            continue
        seen.add(k)
        out.append(it)
    return out

