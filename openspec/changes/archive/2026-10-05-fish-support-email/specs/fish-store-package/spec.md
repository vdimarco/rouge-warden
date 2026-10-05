## MODIFIED Requirements

### Requirement: Privacy policy and listing
The repo SHALL hold a privacy policy page that the game shows offline and the web serves, and the store listing text: the store name "Reel It In: Lake Fishing" (the plain name is taken), subtitle, short and full descriptions, keywords, category, age rating answers, the data safety answers, and the screenshot list. The privacy policy SHALL give the support email, `support@uptick.systems`, as text and as a `mailto:` link.

#### Scenario: Data safety
- **WHEN** a reviewer reads the privacy policy
- **THEN** it says the game collects no personal data, sends nothing off the phone, and keeps progress on the phone only.

#### Scenario: Contact
- **WHEN** a player reads the privacy policy
- **THEN** it shows `support@uptick.systems` as a `mailto:` link to that address

#### Scenario: Placeholder before a release
- **WHEN** a developer builds the bundle for a store upload (`--release`) while a page still holds an owner placeholder (an element with `data-placeholder`)
- **THEN** the build fails and names the placeholder. A debug build and the browser checks still pass, and the bundle check prints a warning.
