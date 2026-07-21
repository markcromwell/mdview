"""Unit tests for mdview library."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))


def test_import():
    import mdview  # noqa: F401
    assert mdview.__version__ == "0.1.0"
