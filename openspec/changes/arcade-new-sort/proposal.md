# New and updated order on All Games

The Cottage Arcade home opens on All Games. Players can rank that list by Featured, Plays, Views, Likes, and Time. Featured stays the default. There is no way to see which games were added or changed most recently.

Add a New control and an Updated control on that same home catalog:

- New lists games newest first by the first commit date of each game's deployed folder.
- Updated lists games by the last commit date of that folder, most recent first.
- Featured, and the other current sorts, stay available.
- The chosen sort is remembered in localStorage and applied again after reload.
- Each card shows a short date: "Added Sep 12" or "Updated Oct 10", following the active date.
- Those dates come from git, written by a script into a JSON file. They are not typed by hand.

Out of scope: the Lab page, the games themselves, and the switcher inside a game.
