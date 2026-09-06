"""Vehicle spec providers — the one place that knows where specs come from.

Catalogue data (years, makes, models, trims for the dropdowns) already comes
from NHTSA vPIC, which is free US government data with no commercial
restriction. This module covers the harder half: engine and economy specs.

Why this file exists
--------------------
API Ninjas' terms say commercial use of its output must stop when a paid plan
ends, so anything built on it is rented rather than owned. That makes it a
bridge, not a foundation. Keeping every call behind one function means
swapping or dropping the provider later is a change here, not surgery across
the app.

The intended end state is CURATED data as the primary source — hand-checked
specs for the cars and bikes people actually cross-shop — with a paid API
covering only the long tail. Curated data has already proven more accurate
than the API twice (the Rebel 1100 power figures, and every Fit Guide
measurement), it has no rate limit, and it survives cancelling a subscription.

IMPORTANT: never seed the curated dataset from API Ninjas output. The whole
point of curating is to own the data outright; copying it across would
re-import the licensing problem it exists to escape.
"""
import os

import requests

# Which provider answers spec lookups. Set SPEC_PROVIDER=none to run with
# curated data only — useful for checking how much of the catalogue is
# actually covered locally before paying for anything.
SPEC_PROVIDER = os.getenv("SPEC_PROVIDER", "apininjas").lower()

API_NINJAS_CARS = "https://api.api-ninjas.com/v1/cars"
API_NINJAS_MOTO = "https://api.api-ninjas.com/v1/motorcycles"
TIMEOUT = 8


def _api_key():
    return os.getenv("API_NINJAS_KEY", "")


def _get(url, params):
    """One upstream call. Returns a list; never raises."""
    key = _api_key()
    if not key:
        return []
    try:
        resp = requests.get(url, headers={"X-Api-Key": key},
                            params=params, timeout=TIMEOUT)
    except requests.RequestException:
        return []
    if resp.status_code != 200:
        return []
    try:
        data = resp.json()
    except ValueError:
        return []
    return data if isinstance(data, list) else []


def model_variants(model):
    """Progressively simpler model strings, most specific first.

    "C-Class" -> ["c-class", "c class", "c"], so a miss on the exact string
    still has a chance of matching how the upstream database spells it.
    """
    m = (model or "").lower().strip()
    if not m:
        return []
    out = [m]
    no_hyphen = m.replace("-", " ").strip()
    if no_hyphen not in out:
        out.append(no_hyphen)
    words = no_hyphen.split()
    if len(words) >= 2:
        two = " ".join(words[:2])
        if two not in out:
            out.append(two)
    if words and words[0] not in out:
        out.append(words[0])
    return out


def _relevant(results, model):
    """Drop rows whose model shares no meaningful word with the search.

    A loose upstream match on "3" can return anything with a 3 in the name,
    so this is what stops an unrelated car being presented as a result.
    """
    words = {w for w in (model or "").lower().replace("-", " ").split()
             if len(w) > 1 and w not in ("the", "and", "for")}
    if not words:
        return results
    return [r for r in results
            if any(w in (r.get("model") or "").lower() for w in words)]


def fetch_car_specs(make, model, year=""):
    """Look up car specs, cheaply.

    The previous implementation tried every model variant both with and
    without the year — up to eight upstream calls for one user search, which
    burns a 100/hour quota in about a dozen searches. This tries the exact
    string with the year, then falls back at most twice, and stops at the
    first usable answer.
    """
    if SPEC_PROVIDER == "none":
        return []

    mk = (make or "").lower().replace("-", " ").strip()
    if not mk:
        return []

    variants = model_variants(model)
    # Most specific first; the year-less retry is what usually rescues a miss,
    # so it runs before the vaguer model strings rather than after all of them.
    attempts = []
    if variants:
        attempts.append((variants[0], year))
        attempts.append((variants[0], ""))
        for v in variants[1:3]:
            attempts.append((v, ""))

    seen = set()
    for att_model, att_year in attempts:
        sig = (att_model, att_year)
        if sig in seen:
            continue
        seen.add(sig)

        params = {"make": mk, "model": att_model}
        if att_year:
            params["year"] = att_year
        data = _get(API_NINJAS_CARS, params)
        if not data:
            continue
        hits = _relevant(data, model)
        if hits:
            return hits
    return []


def fetch_moto_specs(make, model, year=""):
    """Look up motorcycle specs.

    Callers should check the local curated dataset first — it covers the
    common bikes, is more accurate where the two disagree, and costs nothing.
    This is the fallback for everything else.
    """
    if SPEC_PROVIDER == "none":
        return []
    params = {"make": (make or "").strip(), "model": (model or "").strip()}
    if year:
        params["year"] = year
    return _get(API_NINJAS_MOTO, params)
