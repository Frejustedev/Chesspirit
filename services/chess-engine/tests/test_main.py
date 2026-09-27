"""Limites d'entrée du service (revue de sécurité)."""

from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)
KEY = {"x-engine-key": "cle-de-test"}


def setup_module() -> None:
    import os

    os.environ["CHESS_ENGINE_KEY"] = "cle-de-test"


def test_nom_avec_retour_a_la_ligne_refuse() -> None:
    body = {
        "total_rounds": 5,
        "round": 1,
        "players": [
            {"start_no": 1, "name": "A\n001 injecte", "rating": 1500, "points": 0, "rounds": []},
            {"start_no": 2, "name": "B", "rating": 1400, "points": 0, "rounds": []},
        ],
    }
    assert client.post("/pairings/swiss", json=body, headers=KEY).status_code == 422


def test_joueur_inconnu_refuse() -> None:
    body = {"initial": {"a": 1500}, "games": [{"player": "a", "opponent": "x", "score": 1}]}
    assert client.post("/ratings/replay", json=body, headers=KEY).status_code == 422


def test_corps_trop_volumineux() -> None:
    headers = {**KEY, "content-length": str(main.MAX_BODY_BYTES + 1), "content-type": "application/json"}
    assert client.post("/ratings/replay", content=b"{}", headers=headers).status_code == 413
