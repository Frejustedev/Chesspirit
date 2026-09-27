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
