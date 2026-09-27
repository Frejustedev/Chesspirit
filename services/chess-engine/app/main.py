"""Service échecs Chesspirit (FastAPI).

Appelé uniquement par l'application web (clé secrète dans l'en-tête `x-engine-key`),
jamais exposé au navigateur.
"""

from __future__ import annotations

import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .rating import RatingState, apply_game
from .roundrobin import berger_tables
from .swiss import Pair, SwissRequest, bbp_binary, pair_round

app = FastAPI(title="Chesspirit chess-engine", version="0.1.0", docs_url=None, redoc_url=None)


def require_key(x_engine_key: str = Header(default="")) -> None:
    expected = os.environ.get("CHESS_ENGINE_KEY", "")
    if not expected or not hmac.compare_digest(x_engine_key, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"status": "ok", "bbp": bbp_binary() is not None}


@app.post("/pairings/swiss", dependencies=[Depends(require_key)])
def swiss(req: SwissRequest) -> list[Pair]:
    try:
        return pair_round(req)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


class RRRequest(BaseModel):
    players: int = Field(ge=2, le=64)
    double: bool = False


@app.post("/pairings/round-robin", dependencies=[Depends(require_key)])
def round_robin(req: RRRequest) -> list[dict[str, int]]:
    return [
        {"round": r, "board": b, "white": w, "black": bl}
        for r, b, w, bl in berger_tables(req.players, req.double)
    ]


class GameIn(BaseModel):
    player: str
    opponent: str
    score: float = Field(ge=0, le=1)


class RatingRequest(BaseModel):
    """Recalcul rejouable : état initial des joueurs puis parties dans l'ordre chronologique."""

    initial: dict[str, int | None]
    ages: dict[str, int | None] = {}
    games: list[GameIn]


@app.post("/ratings/replay", dependencies=[Depends(require_key)])
def replay(req: RatingRequest) -> dict[str, dict[str, int | bool]]:
    states = {pid: RatingState.initial(fide) for pid, fide in req.initial.items()}
    for g in req.games:
        a, b = states[g.player], states[g.opponent]
        # Mise à jour symétrique à partir des cotes d'avant la partie.
        states[g.player] = apply_game(a, b.rating, g.score, req.ages.get(g.player))
        states[g.opponent] = apply_game(b, a.rating, 1 - g.score, req.ages.get(g.opponent))
    return {
        pid: {"rating": s.rating, "games": s.games, "provisional": s.provisional} for pid, s in states.items()
    }
