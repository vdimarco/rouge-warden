//! The same checks as pop/contract/src/checks.rs. Integer math only.
//! Copied so this binary does not share a crate with the mainnet contract.
use serde_json::Value;

pub struct Verdict { pub pass: bool, pub reason: String }
fn pass(r: String) -> Verdict { Verdict { pass: true, reason: r } }
fn fail(r: &str) -> Verdict { Verdict { pass: false, reason: r.to_string() } }

pub const KINDS: [&str; 4] = ["map", "roster", "paint", "tune"];

/// Checks a spec when a job is posted, so a delivery can never meet a spec that makes no sense.
pub fn valid_spec(kind: &str, spec: &Value) -> Result<(), &'static str> {
    let u = |k: &str| spec.get(k).and_then(Value::as_u64);
    match kind {
        "map" => {
            let (rooms, cols, rows) = (u("rooms").ok_or("spec.rooms")?, u("cols").ok_or("spec.cols")?, u("rows").ok_or("spec.rows")?);
            if !(2..=12).contains(&cols) || !(2..=12).contains(&rows) || rooms < 2 || rooms > cols * rows { return Err("map spec out of range"); }
        }
        "roster" => {
            let (lo, hi, size) = (u("lo").ok_or("spec.lo")?, u("hi").ok_or("spec.hi")?, u("size").ok_or("spec.size")?);
            if lo > hi || !(1..=12).contains(&size) || lo > size * 5 || hi < size { return Err("roster spec out of range"); }
        }
        "paint" => { let c = u("contrast_x100").ok_or("spec.contrast_x100")?; if !(100..=2100).contains(&c) { return Err("contrast out of range"); } }
        "tune" => {
            let bars = u("bars").ok_or("spec.bars")?;
            if !(1..=32).contains(&bars) { return Err("bars out of range"); }
            scale(spec.get("key").and_then(Value::as_str).ok_or("spec.key")?).ok_or("unknown key")?;
        }
        _ => return Err("unknown kind"),
    }
    Ok(())
}

pub fn check(kind: &str, spec: &Value, data: &Value) -> Verdict {
    match kind {
        "map" => map(spec, data),
        "roster" => roster(spec, data),
        "paint" => paint(spec, data),
        "tune" => tune(spec, data),
        _ => fail("unknown kind"),
    }
}

fn cell(v: &Value) -> Option<(i64, i64)> {
    let a = v.as_array()?;
    if a.len() != 2 { return None; }
    Some((a[0].as_i64()?, a[1].as_i64()?))
}

fn map(spec: &Value, d: &Value) -> Verdict {
    let n = spec["rooms"].as_u64().unwrap_or(0) as usize;
    let (cols, rows) = (spec["cols"].as_i64().unwrap_or(0), spec["rows"].as_i64().unwrap_or(0));
    let Some(rooms_v) = d.get("rooms").and_then(Value::as_array) else { return fail("no rooms") };
    let mut rooms: Vec<(i64, i64)> = Vec::new();
    for r in rooms_v {
        let Some(c) = cell(r) else { return fail("bad room") };
        if c.0 < 0 || c.1 < 0 || c.0 >= cols || c.1 >= rows { return fail("room outside the grid"); }
        if rooms.contains(&c) { return fail("room twice"); }
        rooms.push(c);
    }
    if rooms.len() != n { return Verdict { pass: false, reason: format!("{} rooms, asked {}", rooms.len(), n) }; }
    let idx = |c: (i64, i64)| rooms.iter().position(|x| *x == c);
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
    let Some(links) = d.get("links").and_then(Value::as_array) else { return fail("no links") };
    for l in links {
        let Some(pair) = l.as_array() else { return fail("bad link") };
        if pair.len() != 2 { return fail("bad link"); }
        let (Some(a), Some(b)) = (cell(&pair[0]), cell(&pair[1])) else { return fail("bad link") };
        if (a.0 - b.0).abs() + (a.1 - b.1).abs() != 1 { return fail("link between rooms that do not touch"); }
        let (Some(i), Some(j)) = (idx(a), idx(b)) else { return fail("link to a missing room") };
        adj[i].push(j);
        adj[j].push(i);
    }
    let Some(entry) = d.get("entry").and_then(cell).and_then(idx) else { return fail("no entry") };
    let mut seen = vec![false; n];
    let mut queue = vec![entry];
    seen[entry] = true;
    while let Some(i) = queue.pop() {
        for &j in &adj[i] { if !seen[j] { seen[j] = true; queue.push(j); } }
    }
    let cut = seen.iter().filter(|s| !**s).count();
    if cut == 1 { return fail("room cut off"); }
    if cut > 1 { return Verdict { pass: false, reason: format!("{} rooms cut off", cut) }; }
    if d.get("exit").and_then(cell).and_then(idx).is_none() { return fail("no exit"); }
    pass(format!("all {} rooms reach the entry, exit found", n))
}

fn roster(spec: &Value, d: &Value) -> Verdict {
    let (lo, hi, size) = (spec["lo"].as_u64().unwrap_or(0), spec["hi"].as_u64().unwrap_or(0), spec["size"].as_u64().unwrap_or(0));
    let Some(list) = d.get("critters").and_then(Value::as_array) else { return fail("no critters") };
    if list.len() as u64 != size { return Verdict { pass: false, reason: format!("{} critters, asked {}", list.len(), size) }; }
    let mut sum = 0u64;
    for c in list {
        let t = c.get("threat").and_then(Value::as_u64).unwrap_or(0);
        if !(1..=5).contains(&t) { return fail("threat must be 1 to 5"); }
        if c.get("name").and_then(Value::as_str).map_or(true, |s| s.is_empty() || s.len() > 40) { return fail("bad critter name"); }
        sum += t;
    }
    if sum < lo { return Verdict { pass: false, reason: format!("threat {}, too tame ({} to {})", sum, lo, hi) }; }
    if sum > hi { return Verdict { pass: false, reason: format!("threat {}, too deadly ({} to {})", sum, lo, hi) }; }
    pass(format!("threat {}, inside {} to {}", sum, lo, hi))
}

/// sRGB channel value to linear light, in parts per million.
const LIN: [u32; 256] = [0, 304, 607, 911, 1214, 1518, 1821, 2125, 2428, 2732, 3035, 3347, 3677, 4025, 4391, 4777, 5182, 5605, 6049, 6512, 6995, 7499, 8023, 8568, 9134, 9721, 10330, 10960, 11612, 12286, 12983, 13702, 14444, 15209, 15996, 16807, 17642, 18500, 19382, 20289, 21219, 22174, 23153, 24158, 25187, 26241, 27321, 28426, 29557, 30713, 31896, 33105, 34340, 35601, 36889, 38204, 39546, 40915, 42311, 43735, 45186, 46665, 48172, 49707, 51269, 52861, 54480, 56128, 57805, 59511, 61246, 63010, 64803, 66626, 68478, 70360, 72272, 74214, 76185, 78187, 80220, 82283, 84376, 86500, 88656, 90842, 93059, 95307, 97587, 99899, 102242, 104616, 107023, 109462, 111932, 114435, 116971, 119538, 122139, 124772, 127438, 130136, 132868, 135633, 138432, 141263, 144128, 147027, 149960, 152926, 155926, 158961, 162029, 165132, 168269, 171441, 174647, 177888, 181164, 184475, 187821, 191202, 194618, 198069, 201556, 205079, 208637, 212231, 215861, 219526, 223228, 226966, 230740, 234551, 238398, 242281, 246201, 250158, 254152, 258183, 262251, 266356, 270498, 274677, 278894, 283149, 287441, 291771, 296138, 300544, 304987, 309469, 313989, 318547, 323143, 327778, 332452, 337164, 341914, 346704, 351533, 356400, 361307, 366253, 371238, 376262, 381326, 386429, 391572, 396755, 401978, 407240, 412543, 417885, 423268, 428690, 434154, 439657, 445201, 450786, 456411, 462077, 467784, 473531, 479320, 485150, 491021, 496933, 502886, 508881, 514918, 520996, 527115, 533276, 539479, 545724, 552011, 558340, 564712, 571125, 577580, 584078, 590619, 597202, 603827, 610496, 617207, 623960, 630757, 637597, 644480, 651406, 658375, 665387, 672443, 679542, 686685, 693872, 701102, 708376, 715694, 723055, 730461, 737910, 745404, 752942, 760525, 768151, 775822, 783538, 791298, 799103, 806952, 814847, 822786, 830770, 838799, 846873, 854993, 863157, 871367, 879622, 887923, 896269, 904661, 913099, 921582, 930111, 938686, 947307, 955973, 964686, 973445, 982251, 991102, 1000000];

fn hex(v: Option<&Value>) -> Option<[u8; 3]> {
    let s = v?.as_str()?;
    let b = s.as_bytes();
    if b.len() != 7 || b[0] != b'#' { return None; }
    let h = |i: usize| u8::from_str_radix(&s[i..i + 2], 16).ok();
    Some([h(1)?, h(3)?, h(5)?])
}
/// Relative luminance in parts per million.
fn lum(c: [u8; 3]) -> u64 { (2126 * LIN[c[0] as usize] as u64 + 7152 * LIN[c[1] as usize] as u64 + 722 * LIN[c[2] as usize] as u64) / 10_000 }
/// Contrast ratio times 100, as WCAG defines it.
pub fn contrast_x100(a: [u8; 3], b: [u8; 3]) -> u64 {
    let (x, y) = (lum(a), lum(b));
    let (hi, lo) = if x > y { (x, y) } else { (y, x) };
    (hi + 50_000) * 100 / (lo + 50_000)
}

fn paint(spec: &Value, d: &Value) -> Verdict {
    let need = spec["contrast_x100"].as_u64().unwrap_or(300);
    let (Some(f), Some(w)) = (hex(d.get("floor")), hex(d.get("wall"))) else { return fail("colours must be #rrggbb") };
    if hex(d.get("accent")).is_none() { return fail("colours must be #rrggbb"); }
    let c = contrast_x100(f, w);
    let r = format!("{}.{:02}:1", c / 100, c % 100);
    if c < need { return Verdict { pass: false, reason: format!("floor to wall contrast {}, under {}.{:02}:1", r, need / 100, need % 100) }; }
    pass(format!("floor to wall contrast {}", r))
}

fn scale(key: &str) -> Option<[u8; 7]> {
    Some(match key {
        "C major" => [0, 2, 4, 5, 7, 9, 11],
        "A minor" => [9, 11, 0, 2, 4, 5, 7],
        "G major" => [7, 9, 11, 0, 2, 4, 6],
        "E minor" => [4, 6, 7, 9, 11, 0, 2],
        _ => return None,
    })
}

fn tune(spec: &Value, d: &Value) -> Verdict {
    let bars = spec["bars"].as_u64().unwrap_or(0);
    let key = spec["key"].as_str().unwrap_or("");
    let Some(sc) = scale(key) else { return fail("unknown key") };
    let got = d.get("bars").and_then(Value::as_u64).unwrap_or(0);
    if got != bars { return Verdict { pass: false, reason: format!("{} bars, asked {}", got, bars) }; }
    let Some(notes) = d.get("notes").and_then(Value::as_array) else { return fail("no notes") };
    if notes.len() as u64 != bars * 4 { return Verdict { pass: false, reason: format!("{} notes, asked {}", notes.len(), bars * 4) }; }
    let mut off = 0;
    for n in notes {
        let Some(m) = n.as_u64().filter(|m| *m <= 127) else { return fail("notes must be MIDI 0 to 127") };
        if !sc.contains(&((m % 12) as u8)) { off += 1; }
    }
    if off > 0 { return Verdict { pass: false, reason: format!("{} notes out of {}", off, key) }; }
    pass(format!("{} bars, every note in {}", bars, key))
}
