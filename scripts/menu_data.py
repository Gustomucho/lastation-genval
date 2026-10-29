#!/usr/bin/env python3
"""Check published data, or prepare a reviewable menu bundle from a two-column PDF.

Never writes to the source directory: a new PDF/layout must be reviewed before use.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_NAMES = {"Menu.pdf", "menu-page-1.jpg", "menu-page-2.jpg"}
NOTE = ("Carte publiée, sans garantie de disponibilité. Les suppléments sont indiqués "
        "séparément. Pour les allergènes et les régimes alimentaires, demander à l’équipe.")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(root):
    menu = json.loads((root / "menu.json").read_text())
    assert menu["schema_version"] == 1 and menu["currency"] == "EUR"
    assert {f["path"] for f in menu["source"]["files"]} == SOURCE_NAMES
    for source in menu["source"]["files"]:
        assert digest(root / source["path"]) == source["sha256"], (
            source["path"] + " a changé. Régénérer et vérifier le paquet menu avant publication.")
    assert menu["source"]["visible_files"] == ["menu-page-1.jpg", "menu-page-2.jpg"]
    assert isinstance(menu["source"]["pdf_matches_visible_menu"], bool)
    assert menu["source"]["method"] in {"verified_visible_images", "extracted_pdf"}
    assert len(menu["items"]) >= 10, "Extraction incomplète : trop peu de produits."
    ids = set()
    for item in menu["items"]:
        assert item["id"] not in ids
        ids.add(item["id"])
        assert item["name"].strip() and item["category"].strip()
        assert isinstance(item["description"], str)
        assert item["price"] is None or (type(item["price"]) in (int, float) and 0 <= item["price"] <= 1000)
        assert item["price_type"] in {"item", "supplement"}
        assert item["source_page"] in (1, 2)
    print(f"Carte cohérente : {len(ids)} articles, sources vérifiées.")


PRICE = re.compile(r"^(.*?)\s+(\+?\s*\d+(?:\s*[.,]\s*\d+)?|Offert|-)\s*$", re.I)
HOURS = re.compile(r"de (\d{1,2})h(\d{2}) à (\d{1,2})h(\d{2})", re.I)
CATEGORIES = {
    "CAFÉS": "Cafés", "MATCHAS": "Matchas", "EXTRAS": "Extras boissons",
    "Extras :": "Extras lunch", "EXTRAS :": "Extras lunch",
    "THÉS ET INFUSIONS": "Thés et infusions", "GOURMANDS": "Les doudous",
    "LES DOUDOUS": "Les doudous", "KIDS ONLY": "Kids only",
    "BOISSONS FRAÎCHES": "Boissons fraîches", "BIÈRES": "Bières",
    "VINS (au verre)": "Vins au verre", "VINS": "Vins au verre",
    "PETIT-DÉJEUNER": "Petit-déjeuner", "GOURMANDISES": "Gourmandises", "LUNCH": "Lunch",
}


def extract(pdf_path):
    import pdfplumber
    items = []
    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != 2:
            raise ValueError("Deux pages attendues. Nouvelle mise en page : extraction à adapter.")
        for page_number, page in enumerate(pdf.pages, 1):
            # The right column starts with KIDS ONLY (drinks) or LUNCH (food).
            heading = "KIDS" if page_number == 1 else "LUNCH"
            anchors = [w for w in page.extract_words() if w["text"] == heading and w["x0"] > page.width * .4]
            if not anchors:
                raise ValueError(f"Colonne introuvable à la page {page_number}.")
            split = min(w["x0"] for w in anchors) - 5
            x0, y0, x1, y1 = page.bbox
            for box in [(x0, y0, split, y1), (split, y0, x1, y1)]:
                category, hours, current, pending = None, None, None, []
                for line in page.crop(box).extract_text_lines(y_tolerance=5):
                    text = line["text"].strip()
                    if text in ("À BOIRE", "À MANGER", "(au verre)"):
                        continue
                    if text.startswith(("Nos plats", "Une question", "N’hésitez", "Ici, on aime", "Cette carte")):
                        break
                    key = text if text in CATEGORIES else text.upper()
                    if key in CATEGORIES:
                        if pending:
                            raise ValueError("Lignes non associées à un prix : " + " / ".join(pending))
                        category, hours, current = CATEGORIES[key], None, None
                        if category == "Kids only":
                            category += " — boissons" if page_number == 1 else " — à manger"
                        continue
                    schedule = HOURS.fullmatch(text)
                    if schedule:
                        a, b, c, d = schedule.groups()
                        hours = {"opens": f"{int(a):02}:{b}", "closes": f"{int(c):02}:{d}"}
                        continue
                    match = PRICE.match(text)
                    if match:
                        if not category:
                            raise ValueError("Produit sans catégorie : " + text)
                        name, raw_price = match.groups()
                        name = " ".join(pending + [name]).strip()
                        pending = []
                        if not name:
                            raise ValueError("Prix sans produit : " + text)
                        compact = re.sub(r"\s", "", raw_price).replace(",", ".")
                        price = None if compact == "-" else 0 if compact.lower() == "offert" else float(compact.lstrip("+"))
                        current = {"id": f"item-{len(items)+1:02}", "name": name,
                                   "category": category, "description": "", "price": price,
                                   "price_type": "supplement" if category.startswith("Extras") else "item",
                                   "source_page": page_number}
                        if hours:
                            current["service_hours"] = dict(hours)
                        items.append(current)
                    else:
                        size = max((c["size"] for c in line["chars"]), default=0)
                        # Smaller descriptions follow the last named dish. Drink variants
                        # follow a priced drink even at the same font size.
                        variant = text.startswith(("Vanille /", "Avoine (", "Classique /"))
                        if current and (size < 11.8 or variant):
                            current["description"] = (current["description"] + " " + text).strip()
                        elif category:
                            pending.append(text)
                if pending:
                    raise ValueError("Texte sans prix à vérifier : " + " / ".join(pending))
    return items


def build(pdf_path, output):
    if output.resolve() == ROOT or ROOT in output.resolve().parents:
        raise ValueError("Générer dans un dossier extérieur au site pour vérifier avant publication.")
    items = extract(pdf_path)
    # Prepare everything in a temporary directory; failures leave no partial bundle.
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        shutil.copyfile(pdf_path, work / "Menu.pdf")
        subprocess.run(["pdftoppm", "-jpeg", "-r", "100", str(work / "Menu.pdf"), str(work / "menu-page")], check=True)
        source = {"method": "extracted_pdf", "pdf_matches_visible_menu": True,
                  "visible_files": ["menu-page-1.jpg", "menu-page-2.jpg"],
                  "files": [{"path": p, "sha256": digest(work / p)} for p in sorted(SOURCE_NAMES)]}
        menu = {"schema_version": 1, "currency": "EUR", "language": "fr", "source": source, "note": NOTE, "items": items}
        (work / "menu.json").write_text(json.dumps(menu, ensure_ascii=False, indent=2) + "\n")
        check(work)
        output.mkdir(parents=True, exist_ok=True)
        for path in work.iterdir():
            shutil.copyfile(path, output / path.name)
    print("Paquet généré. Vérifier noms, prix, suppléments et descriptions face aux images avant publication.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--pdf", type=Path, default=ROOT / "Menu.pdf")
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    if args.check:
        check(ROOT)
    elif args.output_dir:
        build(args.pdf, args.output_dir)
    else:
        parser.error("Choisir --check ou --output-dir.")
