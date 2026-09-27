"""Tables de Berger (toutes rondes), identiques à packages/shared/src/roundrobin.ts."""

from __future__ import annotations


def berger_tables(n_players: int, double: bool = False) -> list[tuple[int, int, int, int]]:
    """Renvoie (ronde, échiquier, blancs, noirs) ; 0 = exempt."""
    if n_players < 2:
        return []
    n = n_players if n_players % 2 == 0 else n_players + 1
    ring = list(range(1, n))
    out: list[tuple[int, int, int, int]] = []
    for r in range(n - 1):
        first = ring[0]
        pairs = [(first, n) if r % 2 == 0 else (n, first)]
        for i in range(1, n // 2):
            pairs.append((ring[i], ring[n - 1 - i]))
        for b, (w, bl) in enumerate(pairs, start=1):
            bye = n_players % 2 == 1
            out.append((r + 1, b, 0 if bye and w == n else w, 0 if bye and bl == n else bl))
        ring = ring[n // 2 :] + ring[: n // 2]
    if double:
        rounds = n - 1
        out += [(r + rounds, b, bl, w) for r, b, w, bl in list(out)]
    return out
