import subprocess
from pathlib import Path


def test_node_render_contract():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["node", "test/render.test.mjs"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
