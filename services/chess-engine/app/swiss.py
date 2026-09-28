"""Appariements suisses via bbpPairings (système néerlandais FIDE, moteur homologué)."""

from __future__ import annotations

import os
import shutil
import subprocess  # noqa: S404 — exécution d'un binaire local, arguments maîtrisés
import tempfile
from pathlib import Path

from pydantic import BaseModel, Field


class RoundEntry(BaseModel):
    round: int = Field(ge=1)
    opponent: int | None = None  # numéro de départ ; None = pas d'adversaire
    color: str = Field(pattern="^[wb-]$")
    # Codes TRF : 1 0 = (partie jouée), + - (forfait), H F U Z (byes : demi, entier, PAB, zéro)
    result: str = Field(pattern="^[10=+\\-HFUZ]$")


class SwissPlayer(BaseModel):
    start_no: int = Field(ge=1)
    name: str = Field(max_length=33, pattern=r"^[^\r\n]*$")
    rating: int | None = None
    points: float = 0
    history: list[RoundEntry] = []
    absent: bool = False  # ne pas apparier à la ronde demandée (bye à zéro point)
    half_bye: bool = False  # bye demandé à un demi-point
    # Suisse accéléré : points virtuels par ronde (1..total), transmis en lignes XXA.
    acceleration: list[float] = Field(default=[], max_length=40)


class SwissRequest(BaseModel):
    total_rounds: int = Field(ge=1, le=40)
    round: int = Field(ge=1, le=40)
    players: list[SwissPlayer] = Field(min_length=2, max_length=2000)
    # Couleur du premier joueur à la ronde 1 (tirage au sort par l'arbitre).
    initial_color: str = Field(default="white1", pattern="^(white1|black1)$")


class Pair(BaseModel):
    white: int
    black: int | None  # None = exempt (bye attribué par l'appariement)


def _pad(s: str | int | float, n: int, right: bool = False) -> str:
    s = str(s)
    if len(s) >= n:
        return s[:n]
    return s.ljust(n) if right else s.rjust(n)


def trf_line(p: SwissPlayer, target_round: int) -> str:
    line = "001 " + _pad(p.start_no, 4) + " m" + _pad("", 3) + " " + _pad(p.name, 33, True)
    line += (
        " "
        + _pad(p.rating or "", 4)
        + " "
        + _pad("BEN", 3, True)
        + " "
        + _pad("", 11)
        + " "
        + _pad("", 10, True)
    )
    line += " " + _pad(f"{p.points:.1f}", 4) + " " + _pad(p.start_no, 4)
    by_round = {e.round: e for e in p.history}
    for r in range(1, target_round + 1):
        e = by_round.get(r)
        if r == target_round:
            if p.absent:
                e = RoundEntry(round=r, color="-", result="Z")
            elif p.half_bye:
                e = RoundEntry(round=r, color="-", result="H")
            else:
                break
        if e is None:
            e = RoundEntry(round=r, color="-", result="Z")
        opp = _pad(e.opponent, 4) if e.opponent else "0000"
        line += "  " + opp + " " + e.color + " " + e.result
    return line


def build_trf(req: SwissRequest) -> str:
    lines = ["012 Chesspirit", f"XXR {req.total_rounds}", f"XXC {req.initial_color}"]
    ordered = sorted(req.players, key=lambda x: x.start_no)
    lines += [trf_line(p, req.round) for p in ordered]
    for p in ordered:
        if any(v > 0 for v in p.acceleration):
            points = "".join(" " + _pad(f"{v:.1f}", 4) for v in p.acceleration)
            lines.append("XXA " + _pad(p.start_no, 4) + points)
    return "\n".join(lines) + "\n"


def bbp_binary() -> str | None:
    return (
        os.environ.get("BBP_PAIRINGS_BIN") or shutil.which("bbpPairings") or shutil.which("bbpPairings.exe")
    )


def pair_round(req: SwissRequest) -> list[Pair]:
    binary = bbp_binary()
    if not binary:
        raise RuntimeError("bbpPairings introuvable (variable BBP_PAIRINGS_BIN)")
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "in.trf"
        out = Path(tmp) / "out.txt"
        src.write_text(build_trf(req), encoding="utf-8")
        proc = subprocess.run(  # noqa: S603
            [binary, "--dutch", str(src), "-p", str(out)],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"bbpPairings a échoué ({proc.returncode}) : {proc.stderr.strip() or proc.stdout.strip()}"
            )
        rows = out.read_text().split()
    count = int(rows[0])
    pairs: list[Pair] = []
    for i in range(count):
        w, b = int(rows[1 + 2 * i]), int(rows[2 + 2 * i])
        pairs.append(Pair(white=w, black=b or None))
    return pairs
