# Design
Use clearUpdateRanges/addUpdateRange on matrix/color attributes with their actual instance counts. A local upload helper avoids duplicating the same update policy across model cars, fallback cars and markers. Initial allocation remains full capacity. Zero instances do not schedule another upload. No new rendering technique or FPS claim.
