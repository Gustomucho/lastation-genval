import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("menu_data", Path(__file__).resolve().parents[1] / "scripts/menu_data.py")
menu_data = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(menu_data)


def line(text, size=12):
    return {"text": text, "chars": [{"size": size}]}


class Column:
    def __init__(self, lines):
        self.lines = lines

    def extract_text_lines(self, **kwargs):
        return self.lines


class Page:
    width = 595.5
    bbox = (0, -7.83, 595.5, 834.42)

    def __init__(self, heading, left, right):
        self.heading, self.left, self.right = heading, left, right

    def extract_words(self):
        return [{"text": self.heading, "x0": 316}]

    def crop(self, box):
        return Column(self.left if box[0] == 0 else self.right)


class Document:
    def __init__(self):
        self.pages = [
            Page("KIDS", [
                line("CAFÉS", 22), line("Espresso 2.8"),
                line("THÉS ET INFUSIONS", 22), line("Sélection de thés et infusions 4"),
                line("Teatower"), line("Boost détox (chaud ou froid) 4.5"),
                line("LES DOUDOUS", 22), line("Jus de pomme bio et épices 5"),
                line("chaud maison"), line("Pumpkin spice latte 5.5"),
            ], [
                line("KIDS ONLY", 22), line("Babyccino 1.5"),
                line("BIÈRES", 22), line("Bertinchamps blanche"), line("framboise 4,2° 4.5"),
            ]),
            Page("LUNCH", [
                line("PETIT-DÉJEUNER", 22), line("de 7h00 à 11h30"), line("Sunrise Bowl 8.5"),
                line("GOURMANDISES", 22), line("Cookie 3.5"),
                line("Une question sur les allergènes ?"), line("Texte de bas de page"),
            ], [
                line("Ici, on aime le fait maison"), line("Nous sélectionnons nos produits"),
                line("avec attention, en privilégiant le bio"), line("et le local autant que possible."),
                line("LUNCH", 22), line("de 12h00 à 14h00"), line("Toast La Bonne Poire 15"),
                line("Pain au levain, chèvre frais, poire rôtie", 10.5),
                line("UN PETIT EXTRA ?"), line("Œuf au plat ou brouillé bio (1) +2.5"),
                line("Mix & Match ! 15"), line("Compose ton duo : ½ toast au choix", 10.5),
                line("Peur d’avoir le FOMO ?", 10), line("Pourquoi choisir quand on", 10),
            ]),
        ]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class ExtractionTests(unittest.TestCase):
    def extract(self, document=None):
        with patch("pdfplumber.open", return_value=document or Document()):
            return menu_data.extract(Path("fixture.pdf"))

    def test_note_above_lunch_does_not_discard_the_column(self):
        items = self.extract()
        toast = next(i for i in items if i["name"] == "Toast La Bonne Poire")
        self.assertEqual(toast["source_page"], 2)
        self.assertEqual(toast["price"], 15)
        self.assertEqual(toast["category"], "Lunch")
        self.assertEqual(toast["service_hours"], {"opens": "12:00", "closes": "14:00"})
        self.assertIn("poire rôtie", toast["description"])
        self.assertFalse(any("FOMO" in i["description"] for i in items))

    def test_wrapped_names_and_meal_deal_are_assigned_correctly(self):
        items = {i["name"]: i for i in self.extract()}
        self.assertEqual(items["Sélection de thés et infusions Teatower"]["price"], 4)
        self.assertEqual(items["Boost détox (chaud ou froid)"]["price"], 4.5)
        self.assertEqual(items["Jus de pomme bio et épices chaud maison"]["price"], 5)
        self.assertEqual(items["Pumpkin spice latte"]["price"], 5.5)
        self.assertEqual(items["Bertinchamps blanche framboise 4,2°"]["price"], 4.5)
        self.assertEqual(items["Œuf au plat ou brouillé bio (1)"]["price_type"], "supplement")
        self.assertEqual(items["Mix & Match !"]["price_type"], "item")
        self.assertEqual(items["Mix & Match !"]["category"], "Formules lunch")

    def test_empty_column_is_an_error(self):
        document = Document()
        document.pages[1].right = [line("Ici, on aime le fait maison")]
        with self.assertRaisesRegex(ValueError, "colonne sans produit"):
            self.extract(document)

    def test_validation_rejects_missing_page_section_or_duplicate_images(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in menu_data.SOURCE_NAMES:
                (root / name).write_bytes(name.encode())
            data = {
                "schema_version": 1, "currency": "EUR", "items": self.extract(),
                "source": {"method": "extracted_pdf", "pdf_matches_visible_menu": True,
                           "visible_files": ["menu-page-1.jpg", "menu-page-2.jpg"],
                           "files": [{"path": name, "sha256": menu_data.digest(root / name)}
                                     for name in menu_data.SOURCE_NAMES]},
            }
            def verify(value):
                (root / "menu.json").write_text(json.dumps(value))
                menu_data.check(root)
            verify(data)
            missing = copy.deepcopy(data)
            missing["items"] = [i for i in missing["items"] if i["source_page"] == 1]
            # Retain enough items to reach the coverage check instead of the size check.
            missing["items"] *= 2
            with self.assertRaisesRegex(AssertionError, "page du menu"):
                verify(missing)
            missing = copy.deepcopy(data)
            for item in missing["items"]:
                if item["category"] == "Lunch":
                    item["category"] = "Autre"
            with self.assertRaisesRegex(AssertionError, "rubrique principale"):
                verify(missing)
            (root / "menu-page-2.jpg").write_bytes((root / "menu-page-1.jpg").read_bytes())
            duplicate = copy.deepcopy(data)
            for source in duplicate["source"]["files"]:
                source["sha256"] = menu_data.digest(root / source["path"])
            with self.assertRaisesRegex(AssertionError, "images du menu sont identiques"):
                verify(duplicate)


if __name__ == "__main__":
    unittest.main()
