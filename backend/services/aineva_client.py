"""AINEVA avalanche bulletin client.

Fetches CAAML v5 XML from bollettini.aineva.it/albina_files/latest/{province}_it.xml
and normalises it to the EAWS-style dict the frontend parseBulletin() expects.
"""
import time
import html
import xml.etree.ElementTree as ET

import httpx

AINEVA_BASE = "https://bollettini.aineva.it/albina_files/latest"
CACHE_TTL = 6 * 3600  # 6 hours

_NS = {
    "c": "http://caaml.org/Schemas/V5.0/Profiles/BulletinEAWS",
    "gml": "http://www.opengis.net/gml",
    "xlink": "http://www.w3.org/1999/xlink",
}

_cache: dict[str, tuple[float, dict]] = {}  # province_id → (timestamp, data)


def _text(el, tag: str) -> str:
    node = el.find(tag, _NS)
    return html.unescape(node.text or "") if node is not None else ""


def _parse_xml(xml_text: str) -> dict:
    root = ET.fromstring(xml_text)
    bulletins = []

    for bull in root.findall(".//c:Bulletin", _NS):
        bull_id = bull.get("{http://www.opengis.net/gml}id", "")
        begin = _text(bull, ".//c:beginPosition")
        end = _text(bull, ".//c:endPosition")

        regions = [
            el.get("{http://www.w3.org/1999/xlink}href", "")
            for el in bull.findall("c:locRef", _NS)
        ]

        # Danger ratings
        danger_ratings = []
        for dr in bull.findall(".//c:DangerRating", _NS):
            val_el = dr.find("c:mainValue", _NS)
            elev_el = dr.find("c:validElevation", _NS)
            main_value = int(val_el.text) if val_el is not None and val_el.text else 0
            elevation = {}
            if elev_el is not None:
                href = elev_el.get("{http://www.w3.org/1999/xlink}href", "")
                if "Hi" in href or "Lw" in href:
                    # ElevationRange_1500Lw → below 1500m, ElevationRange_1800Hi → above 1800m
                    import re
                    m = re.search(r"(\d+)(Hi|Lw)", href)
                    if m:
                        alt = int(m.group(1))
                        if m.group(2) == "Hi":
                            elevation = {"lowerBound": alt}
                        else:
                            elevation = {"upperBound": alt}
            danger_ratings.append({"mainValue": main_value, "elevation": elevation})

        # Avalanche problems
        problems = []
        for prob in bull.findall(".//c:AvProblem", _NS):
            ptype = _text(prob, "c:type")
            aspects = [
                el.get("{http://www.w3.org/1999/xlink}href", "").replace("AspectRange_", "")
                for el in prob.findall("c:validAspect", _NS)
            ]
            problems.append({"type": ptype, "aspects": aspects})

        meas = bull.find(".//c:BulletinMeasurements", _NS)
        highlights = _text(meas, "c:avActivityHighlights") if meas is not None else ""
        comment = _text(meas, "c:avActivityComment") if meas is not None else ""
        snowpack = _text(meas, "c:snowpackStructureComment") if meas is not None else ""

        bulletins.append({
            "bulletinID": bull_id,
            "validTime": {"startTime": begin, "endTime": end},
            "regions": regions,
            "dangerRatings": danger_ratings,
            "avalancheProblems": problems,
            "highlights": highlights,
            "comment": comment,
            "snowpackComment": snowpack,
        })

    max_danger = max(
        (dr["mainValue"] for b in bulletins for dr in b["dangerRatings"]),
        default=0,
    )
    return {"bulletins": bulletins, "maxDanger": max_danger}


async def fetch_bulletin(province: str) -> dict:
    now = time.time()
    if province in _cache:
        ts, data = _cache[province]
        if now - ts < CACHE_TTL:
            return data

    url = f"{AINEVA_BASE}/{province}_it.xml"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers={"User-Agent": "AlpineSnowMap/1.0"})
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "xml" not in content_type:
            raise RuntimeError(
                f"AINEVA ha restituito content-type imprevisto: {content_type!r}. "
                f"Probabilmente sta servendo una pagina HTML — controlla bollettini.aineva.it"
            )

    data = _parse_xml(resp.text)
    _cache[province] = (now, data)
    return data
