## ADDED Requirements

### Requirement: Mods are opt-in and stand alone
Each mod SHALL be a plugin folder under `mods/` that loads by itself, with `claude --plugin-dir mods/<name>` or from the `mods/` marketplace. A mod SHALL read and write only its own state, and SHALL pass every tool call, prompt and drawing it does not handle to the rest of the chain unchanged.

#### Scenario: One mod
- **WHEN** a person starts Claude Code with `--plugin-dir mods/announcer`
- **THEN** the announcer works, and no other mod loads

#### Scenario: A copy goes stale
- **WHEN** someone changes `public/lab/tilt/physics.js`, a fish in `public/fish/js/species.js`, an announcer clip or a shared helper, and does not run `node mods/sync.mjs`
- **THEN** `node mods/sync.mjs --check` fails and names the stale copy

#### Scenario: A mod fails
- **WHEN** a hook of a mod throws
- **THEN** the tool call, the prompt or the drawing goes on as if the mod were not there

### Requirement: Check runs are judged the same way everywhere
The mods that react to tests SHALL treat a foreground Bash command as a check run when it runs tests, QA scripts, simulations, type checks, lint or plugin tests. A check run SHALL be green when the tool reports no error, the run was not stopped, and the output holds no failure line. Background runs SHALL count as neither green nor red.

#### Scenario: A failing QA script
- **WHEN** `node qa/lab/tilt.sim.mjs` prints a `FAIL` line and exits with code 1
- **THEN** the run is red

#### Scenario: A failure hidden by a pipe
- **WHEN** `npm test 2>&1 | tail -5` exits with code 0 and its output says `2 failed`
- **THEN** the run is red

### Requirement: The announcer calls green streaks
The announcer SHALL call green check runs with the clips and the call names of Shore of the Ancients. The first green run of a session SHALL be "First blood". Two or more green runs in one turn SHALL be "Double kill", "Triple kill", "Mayhem" and then "Rampage". Three or more green runs in a row SHALL take the streak names from "Killing spree" at 3 to "Godlike" at 9 and more. A red run that ends a streak of 3 or more SHALL be "Shut down". A merged pull request SHALL be "Flawless victory" when the session had no red run, else "You win". Every call SHALL show as a toast. Sound SHALL play where Claude Code can play a clip, and its absence SHALL not be an error.

#### Scenario: First blood
- **WHEN** the first green check run of the session ends
- **THEN** a "First blood" toast shows and the first-blood clip plays

#### Scenario: A streak
- **WHEN** the fifth green check run in a row ends, in a turn with no other green run
- **THEN** a "Mega kill" toast shows, and the status line says the streak and the best streak

#### Scenario: Shut down
- **WHEN** a red check run ends a streak of 4
- **THEN** a "Shut down" toast says the 4-run streak ends, the game-over clip plays, and the streak is 0

#### Scenario: A quiet machine
- **WHEN** Claude Code runs on Linux, where no player plays a clip
- **THEN** the toasts still show and nothing reports an error

### Requirement: The cabinet spinner names the game in play
The cabinet spinner SHALL keep a current cabinet: the game whose folder the session last edited. In the terminal, the spinner word SHALL be a verb of that cabinet, and the line that closes a turn SHALL read that cabinet's end phrase and the turn's time, for example "Landed it in 3s". With no cabinet, the arcade's own words SHALL be used. On the desktop and mobile apps the spinner SHALL keep the engine's own step words. The status line SHALL show the cabinet and the arcade tokens: 3 to start, one spent for each prompt a person sends, one back for each green check run, at most 9, and FREE PLAY at 0. `/change` SHALL add 3 tokens. Tokens SHALL never block a prompt.

#### Scenario: Work on Reel It In
- **WHEN** Claude edits a file under `public/fish/` and then works on
- **THEN** the terminal spinner shows a Reel It In verb such as "Reeling", the status line says "Reel It In", and the turn ends with "Landed it in" and the time

#### Scenario: Free play
- **WHEN** the person sends a prompt with 0 tokens left
- **THEN** the prompt runs, and the status line says FREE PLAY

#### Scenario: The change machine
- **WHEN** the person runs `/change` with 1 token
- **THEN** the status line says 4 tokens

### Requirement: The creel lands a fish for each long command
While a foreground Bash command runs for 3 seconds or more, the creel SHALL draw a bobber on the water in the band above the prompt. When that command ends, the creel SHALL land a catch and show the Reel It In reveal line as a toast, with the weight. A green run SHALL land a fish from the Reel It In species, and longer runs SHALL land heavier fish more often. A red run SHALL land junk, most often the Old Boot. A merged pull request SHALL land the Golden Loon Bass. The catch SHALL be kept across sessions. Each day SHALL have one goal, and `/creel` SHALL show the goal, the catch by species and the legends.

#### Scenario: A long green build
- **WHEN** a green build runs for 40 seconds
- **THEN** the bobber shows from the third second, and at the end a toast such as "It is a huge Walleye! 6.1 kg" shows

#### Scenario: A red test run
- **WHEN** a test run that lasted 5 seconds fails
- **THEN** the toast says "It is an Old Boot!"

#### Scenario: A short command
- **WHEN** a command ends in under 3 seconds
- **THEN** no bobber shows and nothing is landed

#### Scenario: The daily goal
- **WHEN** a catch meets today's goal
- **THEN** a toast says the goal is done, and `/creel` shows it done

### Requirement: Subagents swim as Loon Echo chicks
Each subagent SHALL join a line of chicks behind the loon in the band above the prompt while it runs. A subagent that answers SHALL reach the nest. A subagent that fails or is stopped SHALL go to the eel, with a toast that names it. When every chick of a clutch is home, a toast SHALL say so and the next subagent SHALL start a new clutch. `/chicks` SHALL list this session's subagents with their state.

#### Scenario: Three agents
- **WHEN** Claude starts three subagents in the background
- **THEN** the band shows the loon and three swimming chicks

#### Scenario: The eel
- **WHEN** one of them is stopped
- **THEN** a toast says the eel took it, with its description, and the band shows it as taken

#### Scenario: A full nest
- **WHEN** the last swimming chick of a clutch answers
- **THEN** a toast says every chick is home, and the band hides a few seconds later

### Requirement: The tilt sensor guards the house rules
The tilt sensor SHALL know four house rules: an edit to the Olympus source needs `npm run build --prefix games/olympus`; an edit to Follow Suit needs `npm run build:arcade --prefix follow-suit`; a page under `public/` that makes sound loads `/arcade/quiet.js` as its first script in `<head>`, except In Full Swing; and an arcade screen WebP in `public/arcade/` is 480 pixels wide and under 60 KB. An edit that breaks a rule SHALL show a DANGER toast at once and keep the rule open in the status line. A green run of the named build SHALL close its rule. A `git commit` while a rule is open, or while the working tree breaks one, SHALL be blocked with a TILT message that names the fix. `/tilt-sensor` SHALL list the open rules and let the person reset them.

#### Scenario: Olympus without a build
- **WHEN** Claude edits `games/olympus/App.tsx` and then runs `git commit`
- **THEN** a DANGER toast showed after the edit, and the commit is blocked with a TILT message that names `npm run build --prefix games/olympus`

#### Scenario: Build, then commit
- **WHEN** Claude edits `games/olympus/App.tsx`, runs a green `npm run build --prefix games/olympus`, and commits
- **THEN** the commit runs

#### Scenario: A new page with sound
- **WHEN** Claude writes `public/newgame/index.html` that makes an `AudioContext` and does not load `/arcade/quiet.js` first
- **THEN** a DANGER toast names the page and the missing script

#### Scenario: A big screen picture
- **WHEN** the working tree has a new `public/arcade/newgame.webp` of 640 pixels or 80 KB and Claude runs `git commit`
- **THEN** the commit is blocked with a TILT message that names the file and the limits

#### Scenario: The person resets
- **WHEN** the person presses Reset in `/tilt-sensor`
- **THEN** the open rules close, and the next commit runs

### Requirement: Risky moves raise a wanted level
The wanted level SHALL add stars before a risky call runs: 2 for a force push, 1 for a force push with lease, 1 for `rm -rf`, `git reset --hard`, `git clean -f` or `git branch -D`, 2 for a read or edit of a `.env` file other than an example, 1 for an edit of `api/warden.js` or `vercel.json`, 1 for a call to `/api/warden`, and 3 for a Vercel or Supabase call that deletes or pauses a project or a branch. Stars SHALL show in the status line, from 1 to 5, and one star SHALL fade after each 10 minutes with no risky move. At 5 stars, the next risky call SHALL be blocked with a message that says why and how the stars go. `/lay-low` SHALL clear the stars. Calls that are not risky SHALL never be blocked.

#### Scenario: A star
- **WHEN** Claude runs `rm -rf build`
- **THEN** the command runs, a toast says one star for `rm -rf`, and the status line shows one star of five

#### Scenario: Five stars
- **WHEN** the level is at 5 stars and Claude runs `git push --force`
- **THEN** the push does not run, and Claude reads that the wanted level blocked it until the stars fade or the person runs `/lay-low`

#### Scenario: The heat fades
- **WHEN** 10 minutes pass with no risky move at 3 stars
- **THEN** the status line shows 2 stars

### Requirement: Task Breakout shows the OpenSpec tasks as bricks
`/breakout` SHALL open a pane with the active OpenSpec change: the change the session last edited a task list of, else the one whose task list changed last and still has open tasks. Each open task SHALL be a brick, and each done task a gap. A ball and a paddle SHALL play on the wall. When an edit checks a box, the ball SHALL break that brick and a toast SHALL name the task and the count left. When the last box is checked, the pane and a toast SHALL say STAGE CLEAR, and the prompt SHALL suggest the archive. The pane SHALL list the changes with every box checked that are not archived.

#### Scenario: A box is checked
- **WHEN** Claude checks one box in `openspec/changes/fish-store-polish/tasks.md` with 20 open
- **THEN** a toast names the task and says 19 left, and the ball breaks that brick

#### Scenario: Stage clear
- **WHEN** Claude checks the last open box of a change
- **THEN** a STAGE CLEAR toast names the change, and the prompt suggests archiving it

### Requirement: Attract mode grows a Lenia dish when the session is idle
When the main session has been idle for the set number of minutes (3 by default), attract mode SHALL open a pane that runs a Primordia Lenia dish with the Primordia core and colours. The next prompt SHALL close a pane that attract mode opened by itself. `/attract` SHALL open it at any time, and that pane SHALL stay until the person closes it. The dish SHALL seed itself again when its creatures die out.

#### Scenario: Idle
- **WHEN** a turn ends and nobody types for 3 minutes, on a fullscreen terminal 144 columns or wider
- **THEN** a Primordia pane opens beside the transcript, and creatures glide in it

#### Scenario: Back to work
- **WHEN** the person sends a prompt while that pane is open
- **THEN** the pane closes

#### Scenario: A narrow terminal
- **WHEN** the session goes idle on a terminal under 144 columns
- **THEN** the pane waits undrawn, and the next prompt closes it

### Requirement: Full Tilt plays in a pane
`/full-tilt` SHALL open a pane with the Full Tilt table, run by the Full Tilt physics. The keys SHALL be `z` and `m` for the flippers, `l` for a full launch, `k` for a soft launch into the top lanes, `n` for a new game and `p` for a pause. A flip key SHALL raise its flipper for a short tap. Bumpers, slingshots, drop targets and lit lanes SHALL score. Three lit lanes SHALL raise the bonus multiplier, three fallen drop targets SHALL pay a bonus, and a soft launch into a top lane SHALL pay a skill shot. Three balls SHALL make a game, and the best score SHALL be kept across sessions. In the terminal the table SHALL pause while the pane does not hold the keys. On the desktop and mobile apps the pane SHALL draw the table as SVG and take the Buttons.

#### Scenario: A game in the terminal
- **WHEN** the person runs `/full-tilt`, presses `l`, and keeps the ball up with `z` and `m`
- **THEN** the ball flies up the shooter lane, the flippers hit it, and the score rises

#### Scenario: Game over
- **WHEN** the third ball drains
- **THEN** the pane says GAME OVER with the score and the best score, and `n` starts a new game

#### Scenario: Back to the prompt
- **WHEN** the person presses Esc to go back to the prompt
- **THEN** the ball stops where it is until the pane holds the keys again

### Requirement: The photo booth shows the QA shots
After a foreground QA command, the photo booth SHALL look for PNG files that the run wrote: in the folders that the command names with a `SHOTS` or `OUT` variable, and in the folders the QA scripts use by default. When it finds new shots, it SHALL show a toast with the count and open a pane with the newest shot. In the pane, `p` and `n` SHALL step through the shots. The terminal SHALL draw the picture where the terminal can show pictures, and its file name elsewhere. The desktop and mobile apps SHALL show the list of shots with their paths.

#### Scenario: A pinball QA run
- **WHEN** `SHOTS=/tmp/pinball-shots npm run test:pinball --prefix qa/browser` writes 6 PNG files
- **THEN** a toast says 6 new shots, and the pane shows the newest with "1 / 6"

#### Scenario: No shots
- **WHEN** a QA command writes no PNG file
- **THEN** nothing opens

### Requirement: The animated panes stay light
Each animated pane SHALL build a terminal frame in under 4 ms on average on the development machine, measured by `node mods/qa/frames.mjs`, and SHALL repaint the terminal with `$.ui.blit` at most 40 times a second. The SVG frames for the other surfaces SHALL stay under 60,000 characters and SHALL be redrawn at most 8 times a second. A pane SHALL stop its timers when it closes.

#### Scenario: Frame budget
- **WHEN** `node mods/qa/frames.mjs` runs
- **THEN** it prints the mean frame time of Full Tilt, attract mode and Task Breakout, each under 4 ms, and writes a PNG of each pane for review
