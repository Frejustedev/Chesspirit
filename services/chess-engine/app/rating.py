"""Cote Chesspirit (méthode Elo), identique à packages/shared/src/rating.ts.

E = 1 / (1 + 10^((Rb - Ra) / 400)) ; R' = R + K × (S - E)
K = 40 (moins de 30 parties, ou moins de 18 ans sous 2300), 10 (a atteint 2400), 20 sinon.
Le calcul est idempotent : il rejoue l'historique complet des parties dans l'ordre chronologique.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

DEFAULT_START_RATING = 1200
PROVISIONAL_GAMES = 5


def expected_score(ra: float, rb: float) -> float:
    return 1 / (1 + math.pow(10, (rb - ra) / 400))


def k_factor(games_played: int, age: int | None, rating: float, peak: float) -> int:
    if peak >= 2400:
        return 10
    if games_played < 30:
        return 40
    if age is not None and age < 18 and rating < 2300:
        return 40
    return 20


def performance_rating(opponents: list[float], points: float) -> int | None:
    n = len(opponents)
    if n == 0:
        return None
    avg = sum(opponents) / n
    p = points / n
    if p >= 1:
        return round(avg + 800)
    if p <= 0:
        return round(avg - 800)
    dp = -400 * math.log10(1 / p - 1)
    return round(avg + max(-800, min(800, dp)))


@dataclass
class RatingState:
    rating: int
    games: int = 0
    provisional: bool = True
    peak: int = 0
    provisional_games: list[tuple[float, float]] = field(default_factory=list)

    @classmethod
    def initial(cls, fide: int | None, start: int = DEFAULT_START_RATING) -> RatingState:
        if fide and fide > 0:
            return cls(rating=fide, provisional=False, peak=fide)
        return cls(rating=start, provisional=True, peak=start)


def js_round(x: float) -> int:
    """Arrondi « au demi supérieur » comme Math.round en JavaScript (parité avec le client)."""
    return math.floor(x + 0.5)


def apply_game(state: RatingState, opponent: float, score: float, age: int | None) -> RatingState:
    if state.provisional:
        pg = [*state.provisional_games, (opponent, score)]
        games = state.games + 1
        if len(pg) >= PROVISIONAL_GAMES:
            perf = performance_rating([o for o, _ in pg], sum(s for _, s in pg))
            assert perf is not None
            return RatingState(rating=perf, games=games, provisional=False, peak=max(state.peak, perf))
        return RatingState(state.rating, games, True, state.peak, pg)
    k = k_factor(state.games, age, state.rating, state.peak)
    new = js_round(state.rating + k * (score - expected_score(state.rating, opponent)))
    return RatingState(new, state.games + 1, False, max(state.peak, new), [])


# ---------------------------------------------------------------------------
# Rejeu complet (idempotent), identique à replayRatings (packages/shared/src/rating.ts).
# ---------------------------------------------------------------------------
def _age_at(birth: str | None, date: str) -> int | None:
    if not birth:
        return None
    by, bm, bd = (int(x) for x in birth[:10].split("-"))
    dy, dm, dd = (int(x) for x in date[:10].split("-"))
    age = dy - by
    if (dm, dd) < (bm, bd):
        age -= 1
    return age


def replay_ratings(data: dict) -> dict:
    start = data.get("startRating") or DEFAULT_START_RATING
    players = data.get("players", {})
    states: dict[str, dict[str, RatingState]] = {"blitz": {}, "rapid": {}, "classical": {}}
    history: list[dict] = []
    tournaments = sorted(data.get("tournaments", []), key=lambda t: (t["date"], t["id"]))
    for t in tournaments:
        cad = t["cadence"]
        st = states[cad]
        ids: list[str] = []
        for g in t["games"]:
            for pid in (g["white"], g["black"]):
                if pid not in ids:
                    ids.append(pid)
        for pid in ids:
            if pid not in st:
                fide = ((players.get(pid) or {}).get("fide") or {}).get(cad)
                st[pid] = RatingState.initial(fide if fide and fide > 0 else None, start)
        before = {
            pid: RatingState(
                st[pid].rating,
                st[pid].games,
                st[pid].provisional,
                st[pid].peak,
                list(st[pid].provisional_games),
            )
            for pid in ids
        }
        delta: dict[str, float] = {}
        played: dict[str, int] = {}
        pending: dict[str, list[tuple[float, float]]] = {}
        for g in t["games"]:
            for me, opp, s in (
                (g["white"], g["black"], g["score"]),
                (g["black"], g["white"], 1 - g["score"]),
            ):
                b, o = before[me], before[opp]
                played[me] = played.get(me, 0) + 1
                if b.provisional:
                    pending.setdefault(me, []).append((o.rating, s))
                else:
                    age = _age_at((players.get(me) or {}).get("birthDate"), t["date"])
                    k = k_factor(b.games, age, b.rating, b.peak)
                    delta[me] = delta.get(me, 0.0) + k * (s - expected_score(b.rating, o.rating))
        for pid in ids:
            b = before[pid]
            n = played.get(pid, 0)
            if b.provisional:
                allg = b.provisional_games + pending.get(pid, [])
                if len(allg) >= PROVISIONAL_GAMES:
                    perf = performance_rating([x[0] for x in allg], sum(x[1] for x in allg))
                    assert perf is not None
                    nxt = RatingState(perf, b.games + n, False, max(b.peak, perf), [])
                else:
                    nxt = RatingState(b.rating, b.games + n, True, b.peak, allg)
            else:
                r = js_round(b.rating + delta.get(pid, 0.0))
                nxt = RatingState(r, b.games + n, False, max(b.peak, r), [])
            st[pid] = nxt
            history.append(
                {
                    "tournamentId": t["id"],
                    "playerId": pid,
                    "cadence": cad,
                    "before": b.rating,
                    "after": nxt.rating,
                    "games": n,
                }
            )

    def strip(m: dict[str, RatingState]) -> dict:
        return {
            pid: {"rating": s.rating, "games": s.games, "provisional": s.provisional, "peak": s.peak}
            for pid, s in m.items()
        }

    return {"ratings": {c: strip(m) for c, m in states.items()}, "history": history}
