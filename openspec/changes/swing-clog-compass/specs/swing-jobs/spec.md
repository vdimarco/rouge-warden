## ADDED Requirements

### Requirement: The clog compass names the card's clog
While the card says to flush the clogs and names a district, the compass SHALL point at that clog, and its title SHALL name that district. A running job SHALL still title the compass as the job.

#### Scenario: The next clog
- **WHEN** the card says FLUSH THE CLOGS and names a district
- **THEN** the compass title names that same district, and it points at that clog

#### Scenario: A job takes the compass back
- **WHEN** a job starts
- **THEN** the compass title says it is the job
