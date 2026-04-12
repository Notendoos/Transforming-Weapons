from __future__ import annotations

import json
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

INCLUDED_PATHS = [
    ".gitignore",
    "LICENSE",
    "README.md",
    "module.json",
    "lang",
    "scripts",
    "styles",
    "templates",
    "weapon-rule-engine-spec.md",
]


def load_manifest() -> dict:
    with (ROOT / "module.json").open(encoding="utf-8") as handle:
        return json.load(handle)


def reset_dist() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)


def copy_manifest() -> None:
    shutil.copy2(ROOT / "module.json", DIST / "module.json")


def build_archive(package_id: str, version: str) -> Path:
    archive_path = DIST / f"{package_id}-v{version}.zip"
    prefix = Path(package_id)

    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
        for relative_path in INCLUDED_PATHS:
            source = ROOT / relative_path
            if source.is_dir():
                for child in source.rglob("*"):
                    if child.is_dir():
                        continue
                    archive.write(child, prefix / child.relative_to(ROOT))
            elif source.is_file():
                archive.write(source, prefix / relative_path)

    return archive_path


def main() -> None:
    manifest = load_manifest()
    package_id = manifest["id"]
    version = manifest["version"]

    reset_dist()
    copy_manifest()
    archive = build_archive(package_id, version)

    print(f"Built {archive}")


if __name__ == "__main__":
    main()
