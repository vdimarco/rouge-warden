# Show the side-job result in one language

## Why

The result plate mixes French heads with English retry words. The play shell never shows that plate, so the mix cannot be checked without Unreal.

## What changes

A finished side job shows MISSION DONE or MISSION FAILED, the English reason, and the same retry the mission card already uses. The play shell shows that plate with no host, and the stream sends the same words. The native plate uses those words too. Job rules, rewards, and the retry window do not change. No new mission is added.

## Impact

- Affected specs: nord-job-plate
- Affected code: the side-job result lines, the native result plate, and the play shell plate
