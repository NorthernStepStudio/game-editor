"""Build Yun Caribbean House 02 LOD0 and LOD1 from house-config.json."""

from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from yun_house_generator import generate_house  # noqa: E402


if __name__ == "__main__":
    generate_house(HERE / "house-config.json", HERE)

