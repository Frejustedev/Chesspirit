from fastapi.testclient import TestClient

from app.main import app
from app.rating import RatingState, apply_game, expected_score, k_factor, performance_rating
from app.roundrobin import berger_tables

client = TestClient(app)


def test_expected_and_k():
    assert abs(expected_score(1500, 1500) - 0.5) < 1e-9
    assert k_factor(10, 30, 1500, 1500) == 40
    assert k_factor(50, 16, 1800, 1800) == 40
    assert k_factor(50, 30, 1800, 1800) == 20
    assert k_factor(50, 30, 2350, 2410) == 10


def test_performance_and_provisional():
    assert performance_rating([1500], 1) == 2300
    s = RatingState.initial(None)
    for _ in range(4):
        s = apply_game(s, 1400, 1, 20)
    assert s.provisional and s.rating == 1200
    s = apply_game(s, 1400, 0, 20)
    assert not s.provisional
    assert s.rating == performance_rating([1400] * 5, 4)


def test_berger_matches_fide_table():
    t = berger_tables(6)
    r2 = [(w, b) for r, _, w, b in t if r == 2]
    assert r2 == [(6, 4), (5, 3), (1, 2)]
    assert len({r for r, *_ in berger_tables(12, True)}) == 22


def test_api_requires_key(monkeypatch):
    monkeypatch.setenv("CHESS_ENGINE_KEY", "k")
    assert client.get("/health").json()["status"] == "ok"
    assert client.post("/pairings/round-robin", json={"players": 4}).status_code == 401
    res = client.post("/pairings/round-robin", json={"players": 4}, headers={"x-engine-key": "k"})
    assert res.status_code == 200 and len(res.json()) == 6


def test_replay_idempotent(monkeypatch):
    monkeypatch.setenv("CHESS_ENGINE_KEY", "k")
    body = {"initial": {"a": 1800, "b": 1800}, "games": [{"player": "a", "opponent": "b", "score": 1}]}
    r1 = client.post("/ratings/replay", json=body, headers={"x-engine-key": "k"}).json()
    r2 = client.post("/ratings/replay", json=body, headers={"x-engine-key": "k"}).json()
    assert (
        r1
        == r2
        == {
            "a": {"rating": 1820, "games": 1, "provisional": False},
            "b": {"rating": 1780, "games": 1, "provisional": False},
        }
    )


def test_swiss_with_bbp(monkeypatch):
    import os

    import pytest

    binary = os.path.join(os.path.dirname(__file__), "..", "bin", "bbpPairings")
    if not os.path.exists(binary):
        pytest.skip("bbpPairings non compilé (scripts/build-bbp.sh)")
    monkeypatch.setenv("BBP_PAIRINGS_BIN", binary)
    monkeypatch.setenv("CHESS_ENGINE_KEY", "k")
    players = [
        {"start_no": i, "name": f"Joueur {i}", "rating": 2000 - 100 * i, "points": 0, "history": []}
        for i in range(1, 8)
    ]
    r1 = client.post(
        "/pairings/swiss",
        json={"total_rounds": 5, "round": 1, "players": players},
        headers={"x-engine-key": "k"},
    )
    assert r1.status_code == 200
    pairs = r1.json()
    assert len(pairs) == 4 and sum(1 for p in pairs if p["black"] is None) == 1
    # Ronde 1 néerlandaise : 1 contre 4 (moitié haute contre moitié basse), bye au dernier.
    assert {"white": 1, "black": 4} in pairs or {"white": 4, "black": 1} in pairs
    assert {"white": 7, "black": None} in pairs
    # Un joueur absent n'est pas apparié.
    players[6]["absent"] = True
    r2 = client.post(
        "/pairings/swiss",
        json={"total_rounds": 5, "round": 1, "players": players},
        headers={"x-engine-key": "k"},
    ).json()
    assert all(7 not in (p["white"], p["black"]) for p in r2) and len(r2) == 3


def test_replay_matches_shared_fixture(monkeypatch):
    import json
    import pathlib

    from app.rating import replay_ratings

    fx = json.loads(
        (pathlib.Path(__file__).parents[3] / "packages/shared/fixtures/rating-replay.json").read_text(
            encoding="utf-8"
        )
    )
    out = replay_ratings(fx["input"])
    assert out["ratings"]["rapid"] == fx["expected"]["ratings"]["rapid"]
    for pid, (before, after) in fx["expected"]["history_t1"].items():
        h = next(x for x in out["history"] if x["tournamentId"] == "t1" and x["playerId"] == pid)
        assert (h["before"], h["after"]) == (before, after)
    monkeypatch.setenv("CHESS_ENGINE_KEY", "k")
    api = client.post("/ratings/replay-tournaments", json=fx["input"], headers={"x-engine-key": "k"}).json()
    assert api["ratings"]["rapid"] == fx["expected"]["ratings"]["rapid"]
