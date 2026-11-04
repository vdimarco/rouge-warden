"""Hometown Arcade: turn any real place into a drivable browser game, with missions Hermes writes.

register(ctx) wires six tools, one slash command and one skill.
"""

from __future__ import annotations

import logging
from pathlib import Path

from . import schemas, tools

logger = logging.getLogger(__name__)

TOOLSET = "hometown"
_EMOJI = {"hometown_build": "\U0001F3D9", "hometown_mission": "\U0001F3C1"}


def register(ctx):
    try:
        tools.configure(ctx.get_config)
    except Exception:  # an older Hermes without plugin settings
        pass
    for schema in schemas.ALL:
        ctx.register_tool(
            name=schema["name"],
            toolset=TOOLSET,
            schema=schema,
            handler=tools.HANDLERS[schema["name"]],
            description=schema["description"].split(". ")[0],
            emoji=_EMOJI.get(schema["name"], "\U0001F697"),
        )
    ctx.register_command(
        "hometown",
        tools.slash_command,
        description="Build a drivable game of a real place: /hometown <address or place>",
        args_hint="<address or place>",
    )
    skill = Path(__file__).resolve().parent / "skills" / "hometown-arcade" / "SKILL.md"
    try:
        ctx.register_skill("hometown-arcade", skill,
                           description="Write good missions for Hometown Arcade maps and adapt them to the player.")
    except Exception as exc:  # skills are a bonus; the tools work without one
        logger.debug("hometown-arcade skill not registered: %s", exc)
