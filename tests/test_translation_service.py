import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from translation_service import TranslationService


def test_translate_text_uses_builtin_terms(tmp_path):
    service = TranslationService(
        providers=["youdao"],
        cache_path=tmp_path / "cache.json",
    )

    assert service.translate_text("Draw") == "平局"
    assert service.translate_text("Over") == "大"
    assert service.translate_text("Under") == "小"


def test_translate_many_deduplicates_and_persists_cache(monkeypatch, tmp_path):
    calls = []

    def fake_translate_text(text, **kwargs):
        calls.append((text, kwargs["translator"]))
        return f"zh:{text}"

    monkeypatch.setattr("translation_service.ts.translate_text", fake_translate_text)

    cache_path = tmp_path / "translation_cache.json"
    service = TranslationService(
        providers=["youdao"],
        cache_path=cache_path,
        term_translations={},
    )

    result = service.translate_many(["Arsenal", "Arsenal", "Chelsea"])

    assert result == {"Arsenal": "zh:Arsenal", "Chelsea": "zh:Chelsea"}
    assert calls == [("Arsenal", "youdao"), ("Chelsea", "youdao")]

    second_service = TranslationService(
        providers=["youdao"],
        cache_path=cache_path,
        term_translations={},
    )
    assert second_service.translate_text("Arsenal") == "zh:Arsenal"


def test_translate_matches_skips_bookmakers(monkeypatch, tmp_path):
    calls = []

    def fake_translate_text(text, **kwargs):
        calls.append(text)
        return f"zh:{text}"

    monkeypatch.setattr("translation_service.ts.translate_text", fake_translate_text)

    service = TranslationService(
        providers=["youdao"],
        cache_path=tmp_path / "translation_cache.json",
        term_translations={},
    )

    matches = [
        {
            "home_team": "Arsenal",
            "away_team": "Chelsea",
            "sport_title": "Premier League",
            "bookmakers": [{"bookmaker": "BetMGM"}, {"bookmaker": "BetMGM"}],
        },
        {
            "home_team": "Arsenal",
            "away_team": "Liverpool",
            "sport_title": "Premier League",
            "bookmakers": [{"bookmaker": "DraftKings"}],
        },
    ]

    translated = service.translate_matches(matches)

    assert translated[0]["home_team"] == "zh:Arsenal"
    assert translated[0]["bookmakers"][0]["bookmaker"] == "BetMGM"
    assert translated[1]["bookmakers"][0]["bookmaker"] == "DraftKings"
    assert calls == ["Arsenal", "Chelsea", "Premier League", "Liverpool"]
