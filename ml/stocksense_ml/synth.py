"""Reproducible synthetic kirana sales over several years.

Same ingredients as ``samples/sample-sales-1-year.csv`` (Poisson demand, weekend lift, mild
yearly cycle, festival spikes on festive items) but long enough that each festival repeats,
which a one-year history cannot show. It is a test bed, not evidence about real shops.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .calendar import festivals

# sku, name, typical units/day, festive item?
CATALOGUE = [
    ("MILK500", "Amul Taaza Milk 500ml", 45, False),
    ("PARLE", "Parle-G Biscuits", 35, False),
    ("SUG1", "Sugar 1kg", 30, True),
    ("MAGGI4", "Maggi Noodles 4-pack", 20, False),
    ("SALT1", "Tata Salt 1kg", 18, False),
    ("OIL1", "Groundnut Oil 1L", 16, True),
    ("CURD400", "Curd 400g", 15, False),
    ("TEA250", "Tata Tea 250g", 14, False),
    ("DAL1", "Toor Dal 1kg", 12, False),
    ("MARIE", "Marie Biscuits", 12, False),
    ("MATCH", "Matchbox 10-pack", 10, False),
    ("BUTTER100", "Amul Butter 100g", 10, True),
    ("SEV400", "Sev 400g", 9, True),
    ("AGARB", "Agarbatti", 9, True),
    ("ATTA5", "Atta 5kg", 9, False),
    ("CHANA1", "Chana Dal 1kg", 8, False),
    ("TPASTE", "Toothpaste 150g", 8, False),
    ("POHA1", "Poha 1kg", 8, True),
    ("BESAN1", "Besan 1kg", 7, True),
    ("MOONG1", "Moong Dal 1kg", 7, False),
    ("JAGG1", "Jaggery 1kg", 6, True),
    ("TEA1", "Tata Tea Premium 1kg", 6, False),
    ("SOAP4", "Bath Soap 4-pack", 6, False),
    ("DETG1", "Detergent 1kg", 5, False),
    ("RICE5", "Rice 5kg", 5, False),
    ("SHAMP", "Shampoo 180ml", 4, False),
    ("COF100", "Nescafe Classic 100g", 4, False),
    ("ATTA10", "Atta 10kg", 4, False),
    ("GHEE1", "Ghee 1L", 3, True),
    ("OIL5", "Groundnut Oil 5L", 3, True),
]

FESTIVAL_LIFT = {
    "diwali": 2.2,
    "navratri_dussehra": 1.8,
    "uttarayan": 1.6,
    "holi": 1.5,
    "raksha_bandhan": 1.4,
    "ganesh_chaturthi": 1.4,
    "janmashtami": 1.3,
}
WEEKDAY = np.array([0.95, 0.92, 0.95, 0.97, 1.02, 1.15, 1.2])  # Mon..Sun


def festival_multiplier(dates: pd.DatetimeIndex, festive_item: bool, rng: np.random.Generator) -> np.ndarray:
    mult = np.ones(len(dates))
    d = dates.values.astype("datetime64[D]")
    for row in festivals().itertuples():
        lift = FESTIVAL_LIFT.get(row.name, 1.3)
        lift = 1 + (lift - 1) * rng.uniform(0.7, 1.3) if festive_item else 1 + rng.uniform(0.0, 0.1)
        start, end = np.datetime64(row.start.date()), np.datetime64(row.end.date())
        to = (start - d).astype(int)
        inside = (d >= start) & (d <= end)
        ramp = (to > 0) & (to <= row.lead_days)
        m = np.where(inside, lift, np.where(ramp, 1 + (lift - 1) * (1 - to / (row.lead_days + 1)), 1.0))
        mult = np.maximum(mult, m)
    return mult


def generate(
    start: str = "2024-01-01", end: str = "2026-10-25", n_products: int = 30, seed: int = 7
) -> pd.DataFrame:
    """Long sales rows ``date, sku, product, quantity`` (zero days omitted, like real exports)."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start, end, freq="D")
    doy = dates.dayofyear.to_numpy()
    years = (dates - dates[0]).days.to_numpy() / 365.25
    out = []
    for sku, name, base, festive in CATALOGUE[:n_products]:
        level = base * rng.uniform(0.8, 1.2)
        phase = rng.uniform(0, 2 * np.pi)
        lam = (
            level
            * WEEKDAY[dates.dayofweek.to_numpy()]
            * (1 + 0.1 * np.sin(2 * np.pi * doy / 365.25 + phase))
            * (1 + rng.uniform(-0.05, 0.1) * years)
            * festival_multiplier(dates, festive, rng)
        )
        qty = rng.poisson(lam)
        sold = qty > 0
        out.append(
            pd.DataFrame({"date": dates[sold].strftime("%Y-%m-%d"), "sku": sku, "product": name, "quantity": qty[sold]})
        )
    return pd.concat(out, ignore_index=True).sort_values(["date", "sku"], ignore_index=True)
