import sys
import os

# Ensure the 'src' directory is in the PYTHONPATH so Vercel can find the package
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from github_viz.server import create_app

# Vercel's Python runtime searches for an 'app' variable by default.
app = create_app()
