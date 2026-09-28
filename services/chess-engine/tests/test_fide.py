"""Import FIDE : lecture en flux d'une liste XML zippée (fixture locale)."""

import io
import zipfile

from app.fide import FideImportRequest, import_list, parse_players

XML = b"""<?xml version="1.0" encoding="utf-8"?>
<playerslist>
<player><fideid>1111</fideid><name>Doe, Jane</name><country>BEN</country><sex>F</sex><title>WFM</title>
<rating>1850</rating><rapid_rating>1800</rapid_rating><blitz_rating>0</blitz_rating><birthday>1999</birthday></player>
<player><fideid>2222</fideid><name>Other, Tom</name><country>TOG</country><sex>M</sex>
<rating>2000</rating><rapid_rating></rapid_rating><blitz_rating>1950</blitz_rating>
<birthday>1990</birthday></player>
<player><fideid>3333</fideid><name>Far, Away</name><country>FRA</country>
<sex>M</sex><rating>2100</rating></player>
</playerslist>"""


def test_parse_filtre_federation_et_identifiants() -> None:
    players = parse_players(io.BytesIO(XML), "BEN", {"2222"})
    assert [p.fide_id for p in players] == ["1111", "2222"]
    jane = players[0]
    got = (jane.standard, jane.rapid, jane.blitz, jane.title, jane.birth_year)
    assert got == (1850, 1800, None, "WFM", 1999)
    assert players[1].rapid is None and players[1].blitz == 1950


def test_import_zip_local(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("FIDE_ALLOW_FILE", "1")
    z = tmp_path / "list.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr("players_list_xml_foa.xml", XML)
    players = import_list(FideImportRequest(url=f"file://{z}", federation="BEN"))
    assert [p.fide_id for p in players] == ["1111"]
