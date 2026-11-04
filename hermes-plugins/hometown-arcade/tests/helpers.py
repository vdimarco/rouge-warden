"""Load the plugin the way Hermes does: as a package from its folder, with a scratch data folder."""

import importlib
import importlib.util
import sys
import tempfile
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parents[1]
FIXTURE = PLUGIN_DIR / "tests" / "fixtures" / "la-fontaine.osm"
CENTRE = "45.5268,-73.5698"
PKG = "hometown_arcade_under_test"

DATA_ROOT = Path(tempfile.mkdtemp(prefix="hometown-test-data-"))


def load():
    if PKG in sys.modules:
        return sys.modules[PKG]
    spec = importlib.util.spec_from_file_location(PKG, PLUGIN_DIR / "__init__.py",
                                                  submodule_search_locations=[str(PLUGIN_DIR)])
    mod = importlib.util.module_from_spec(spec)
    sys.modules[PKG] = mod
    spec.loader.exec_module(mod)
    importlib.import_module(f"{PKG}.game").DATA_ROOT_OVERRIDE = DATA_ROOT  # keep test maps out of ~/.hermes
    return mod


def sub(name):
    load()
    return importlib.import_module(f"{PKG}.{name}")


class RecordingContext:
    """Stands in for Hermes's PluginContext, like the catalog validator's probe."""

    def __init__(self, config=None):
        self.tools, self.hooks, self.commands, self.skills = {}, [], {}, {}
        self.config = config or {}

    def register_tool(self, name, toolset, schema, handler, **kwargs):
        assert name not in self.tools, name
        self.tools[name] = {"toolset": toolset, "schema": schema, "handler": handler, **kwargs}

    def register_hook(self, name, fn, **kwargs):
        self.hooks.append(name)

    def register_command(self, name, handler, description="", args_hint="", **kwargs):
        self.commands[name] = handler

    def register_skill(self, name, path, description="", **kwargs):
        assert Path(path).is_file(), path
        self.skills[name] = Path(path)

    def get_config(self, key, default=None):
        return self.config.get(key, default)
