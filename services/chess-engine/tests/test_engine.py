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
    assert client.get("/health").json() == {"status": "ok"}
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
