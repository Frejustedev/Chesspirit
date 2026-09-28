"""Service échecs Chesspirit (FastAPI).

Appelé uniquement par l'application web (clé secrète dans l'en-tête `x-engine-key`),
jamais exposé au navigateur.
"""

from __future__ import annotations

import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .fide import FideImportRequest, FidePlayer, import_list
from .rating import RatingState, apply_game, replay_ratings
from .roundrobin import berger_tables
from .swiss import Pair, SwissRequest, bbp_binary, pair_round

app = FastAPI(title="Chesspirit chess-engine", version="0.1.0", docs_url=None, redoc_url=None)

# Taille maximale d'une requête (l'historique complet des parties tient largement en dessous).
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", str(20 * 1024 * 1024)))


@app.middleware("http")
async def limit_body(request: Request, call_next):  # type: ignore[no-untyped-def]
    length = request.headers.get("content-length")
    if length is not None and (not length.isdigit() or int(length) > MAX_BODY_BYTES):
        return JSONResponse({"detail": "payload too large"}, status_code=413)
    if length is None and request.method in ("POST", "PUT", "PATCH"):
        return JSONResponse({"detail": "length required"}, status_code=411)
    return await call_next(request)


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
    games: list[GameIn] = Field(max_length=500_000)


@app.post("/ratings/replay", dependencies=[Depends(require_key)])
def replay(req: RatingRequest) -> dict[str, dict[str, int | bool]]:
    states = {pid: RatingState.initial(fide) for pid, fide in req.initial.items()}
    for g in req.games:
        if g.player not in states or g.opponent not in states:
            raise HTTPException(status_code=422, detail="unknown player in games")
        a, b = states[g.player], states[g.opponent]
        # Mise à jour symétrique à partir des cotes d'avant la partie.
        states[g.player] = apply_game(a, b.rating, g.score, req.ages.get(g.player))
        states[g.opponent] = apply_game(b, a.rating, 1 - g.score, req.ages.get(g.opponent))
    return {
        pid: {"rating": s.rating, "games": s.games, "provisional": s.provisional} for pid, s in states.items()
    }


@app.post("/ratings/replay-tournaments", dependencies=[Depends(require_key)])
def replay_tournaments(data: dict) -> dict:
    """Rejoue tous les tournois homologués (idempotent) et renvoie cotes et historique."""
    try:
        return replay_ratings(data)
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"invalid input: {e}") from e


@app.post("/fide/import", dependencies=[Depends(require_key)])
def fide_import(req: FideImportRequest) -> list[FidePlayer]:
    """Liste FIDE du mois, filtrée (fédération et identifiants des joueurs Chesspirit)."""
    try:
        return import_list(req)
    except (OSError, ValueError, StopIteration) as e:
        raise HTTPException(status_code=502, detail=f"fide list unavailable: {e}") from e
