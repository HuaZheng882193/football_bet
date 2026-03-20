import json
import os
from pathlib import Path
from threading import RLock

import translators as ts


TERM_TRANSLATIONS = {
    "draw": "平局",
    "over": "大",
    "under": "小",
    "premier league": "英超",
    "epl": "英超",
    "la liga": "西甲",
    "bundesliga": "德甲",
    "serie a": "意甲",
    "ligue 1": "法甲",
    "uefa champions league": "欧冠",
    "uefa europa league": "欧联",
    "chinese super league": "中超",
    "super league": "中超",
    "soccer": "足球",
    "football": "足球",
}


def _default_cache_path():
    raw_path = os.getenv("TRANSLATION_CACHE_FILE")
    if raw_path:
        return Path(raw_path)
    return Path.cwd() / "translation_cache.json"


class TranslationService:
    def __init__(
        self,
        providers=None,
        from_language="en",
        to_language="zh",
        cache_path=None,
        term_translations=None,
    ):
        provider_list = providers or os.getenv("TRANSLATOR_PROVIDERS", "youdao").split(",")
        self.providers = [provider.strip() for provider in provider_list if provider.strip()]
        self.from_language = from_language
        self.to_language = to_language
        self.cache_path = Path(cache_path) if cache_path else _default_cache_path()
        source_terms = TERM_TRANSLATIONS if term_translations is None else term_translations
        self.term_translations = {
            key.strip().lower(): value for key, value in source_terms.items()
        }
        self._cache = {}
        self._lock = RLock()
        self._load_cache()

    def _normalize(self, text):
        if not isinstance(text, str):
            return ""
        return text.strip()

    def _lookup_term_translation(self, text):
        normalized = self._normalize(text)
        if not normalized:
            return text
        return self.term_translations.get(normalized.lower())

    def _load_cache(self):
        with self._lock:
            if not self.cache_path.exists():
                self._cache = {}
                return

            try:
                self._cache = json.loads(self.cache_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                self._cache = {}

    def _save_cache(self):
        with self._lock:
            try:
                self.cache_path.parent.mkdir(parents=True, exist_ok=True)
                temp_path = self.cache_path.with_suffix(f"{self.cache_path.suffix}.tmp")
                temp_path.write_text(
                    json.dumps(self._cache, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                temp_path.replace(self.cache_path)
            except OSError:
                return

    def _translate_online(self, text):
        for provider in self.providers:
            try:
                translated = ts.translate_text(
                    text,
                    translator=provider,
                    from_language=self.from_language,
                    to_language=self.to_language,
                    if_print_warning=False,
                )
                if translated:
                    return translated
            except Exception:
                continue
        return text

    def translate_text(self, text):
        normalized = self._normalize(text)
        if not normalized:
            return text

        local_translation = self._lookup_term_translation(normalized)
        if local_translation:
            return local_translation

        with self._lock:
            cached = self._cache.get(normalized)
            if cached is not None:
                return cached

        translated = self._translate_online(normalized)

        with self._lock:
            self._cache[normalized] = translated
        self._save_cache()
        return translated

    def translate_many(self, texts):
        translations = {}
        pending = []
        seen = set()

        for text in texts:
            normalized = self._normalize(text)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)

            local_translation = self._lookup_term_translation(normalized)
            if local_translation:
                translations[normalized] = local_translation
                continue

            with self._lock:
                cached = self._cache.get(normalized)

            if cached is not None:
                translations[normalized] = cached
                continue

            pending.append(normalized)

        if pending:
            updated_cache = False
            for text in pending:
                translated = self._translate_online(text)
                translations[text] = translated
                with self._lock:
                    self._cache[text] = translated
                updated_cache = True

            if updated_cache:
                self._save_cache()

        return translations

    def translate_sports(self, sports):
        titles = [sport.get("title") for sport in sports if isinstance(sport, dict)]
        translations = self.translate_many(titles)

        translated_sports = []
        for sport in sports:
            item = dict(sport)
            title = self._normalize(item.get("title"))
            if title:
                item["title"] = translations.get(title, item["title"])
            translated_sports.append(item)
        return translated_sports

    def translate_matches(self, matches):
        texts = []
        for match in matches:
            texts.extend(
                [
                    match.get("home_team"),
                    match.get("away_team"),
                    match.get("sport_title"),
                ]
            )
        translations = self.translate_many(texts)

        translated_matches = []
        for match in matches:
            translated_match = dict(match)

            home_team = self._normalize(match.get("home_team"))
            away_team = self._normalize(match.get("away_team"))
            sport_title = self._normalize(match.get("sport_title"))

            if home_team:
                translated_match["home_team"] = translations.get(home_team, match.get("home_team"))
            if away_team:
                translated_match["away_team"] = translations.get(away_team, match.get("away_team"))
            if sport_title:
                translated_match["sport_title"] = translations.get(sport_title, match.get("sport_title"))

            translated_bookmakers = []
            for bookmaker in match.get("bookmakers", []):
                translated_bookmaker = dict(bookmaker)
                translated_bookmakers.append(translated_bookmaker)

            translated_match["bookmakers"] = translated_bookmakers
            translated_matches.append(translated_match)
        return translated_matches


translator = TranslationService()
