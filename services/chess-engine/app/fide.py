"""Import mensuel des Elo FIDE depuis la liste officielle (XML zippé), filtrée par fédération et identifiants.

Le fichier complet fait plusieurs centaines de Mo décompressé : il est lu en flux (iterparse)
sans être chargé en mémoire.
"""

from __future__ import annotations

import os
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from defusedxml.ElementTree import iterparse
from pydantic import BaseModel, Field

OFFICIAL_URL = "https://ratings.fide.com/download/players_list_xml.zip"
MAX_DOWNLOAD = 300 * 1024 * 1024


class FideImportRequest(BaseModel):
    url: str = Field(default=OFFICIAL_URL, pattern=r"^https://ratings\.fide\.com/|^file://")
    federation: str = Field(default="BEN", pattern="^[A-Z]{3}$")
    ids: list[str] = Field(default=[], max_length=20000)


class FidePlayer(BaseModel):
    fide_id: str
    name: str | None
    federation: str | None
    title: str | None
    standard: int | None
    rapid: int | None
    blitz: int | None
    birth_year: int | None
    sex: str | None


def _int(v: str | None) -> int | None:
    try:
        n = int((v or "").strip())
        return n if n > 0 else None
    except ValueError:
        return None


def parse_players(xml_file, federation: str, ids: set[str]) -> list[FidePlayer]:
    """Parcourt le XML en flux et garde la fédération demandée et les identifiants connus."""
    out: list[FidePlayer] = []
    for _event, el in iterparse(xml_file, events=("end",)):
        if el.tag != "player":
            continue

        def get(tag: str, node=el) -> str | None:
            return (node.findtext(tag) or "").strip() or None

        fid = get("fideid")
        country = get("country")
        if fid and (country == federation or fid in ids):
            out.append(
                FidePlayer(
                    fide_id=fid,
                    name=get("name"),
                    federation=country,
                    title=get("title"),
                    standard=_int(get("rating")),
                    rapid=_int(get("rapid_rating")),
                    blitz=_int(get("blitz_rating")),
                    birth_year=_int(get("birthday")),
                    sex=get("sex"),
                )
            )
        el.clear()
    return out


def import_list(req: FideImportRequest) -> list[FidePlayer]:
    # Fichier local seulement si explicitement autorisé (tests, import manuel d'une liste téléchargée).
    if req.url.startswith("file://") and os.environ.get("FIDE_ALLOW_FILE") != "1":
        raise ValueError("fichier local non autorisé")
    ids = set(req.ids)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "list.zip"
        with urllib.request.urlopen(req.url, timeout=120) as res, open(path, "wb") as f:  # noqa: S310
            size = 0
            while chunk := res.read(1 << 20):
                size += len(chunk)
                if size > MAX_DOWNLOAD:
                    raise ValueError("liste FIDE trop volumineuse")
                f.write(chunk)
        with zipfile.ZipFile(path) as z:
            name = next(n for n in z.namelist() if n.lower().endswith(".xml"))
            with z.open(name) as xml:
                return parse_players(xml, req.federation, ids)
