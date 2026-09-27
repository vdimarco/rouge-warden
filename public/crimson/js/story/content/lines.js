// js/story/content/lines.js : every spoken or shown line of the story (design 2.5 with AMENDMENTS E1-E10).
// A line is { who, text } or { who, text, byPick: { crewId: text } } for the lines that change with the
// player's pick (the pick is the narrator from C0 on). who is a CAST id, 'pick' (the player's friend), or a
// voice the UI names: 'all', 'voice', 'radio', 'clerk', 'guide', 'phone', 'note', 'passenger', ''.
// {PICK} in a text is the pick's name. Rules (text.mjs checks them): plain short sentences, no dashes used
// as dashes, 16 words or fewer a sentence, 84 characters or fewer a line (two subtitle lines of 42).
// Tone (design 2.2): the people who are held are never a joke, a prop or a score. Dana speaks for herself.

const L = (who, text, byPick) => (byPick ? { who, text, byPick } : { who, text });

export const LINES = {
  /* ---------------- C0 The Bear Yields (arena) ---------------- */
  'c0.swing': L('gabe', 'Nice swing.'),
  'c0.gabe': L('pick', 'Gabe?', { tanktop: 'Gabe? Big guy?', fifty: 'Gabe? Is that you?', shades: 'Gabe? No way.', newbalance: 'Gabe? Are you okay?', redjersey: 'Gabe? Buddy?' }),
  'c0.buddy': L('gabe', 'Hey, buddy. Long time.'),
  'c0.down': L('gabe', 'Get down. Now.'),
  'c0.voice': L('voice', "The van's here. Where's the Bear?"),

  /* ---------------- I0 Under the Bridge ---------------- */
  'i0.cost': L('gabe', 'You just cost me seven months.'),
  'i0.what': L('fifty', 'Seven months of what?'),
  'i0.first': L('gabe', 'You first.'),
  'i0.why': L('gabe', 'Why are five grown men dressed as samurai under Midgley Bridge?'),
  'i0.three': L('gabe', 'At three in the morning.'),
  'i0.ronin': L('fifty', 'Ronin.'),
  'i0.dark': L('tanktop', 'In our defense, it was very dark. And you were very hairy.'),
  'i0.vo': L('pick', "Okay. So. You're probably wondering how we got here.", { shades: "Okay. So. You're wondering how we got here. Fair." }),

  /* ---------------- F1 Ten Seats (New Balance) ---------------- */
  'f1.seats': L('clerk', 'Fifteen-passenger van. We took the back seats out. It seats ten.'),
  'f1.last': L('newbalance', 'It was the last one.'),
  'f1.whale': L('tanktop', "It's a whale."),
  'f1.fuel': L('newbalance', 'Gas first. Then Uptown. I have a list.'),
  'f1.nice': L('rattler', 'Nice van.'),
  'f1.twins': L('redjersey', 'Twins!'),
  'f1.box': L('shades', "What's in the box?"),
  'f1.boxNo': L('fifty', "Saturday stuff. Don't open it."),
  'f1.kazoos': L('redjersey', 'Kazoos! Why are there kazoos?'),
  'f1.toast': L('fifty', 'For the toast. There were fifty-one.'),
  'f1.kazooRule': L('', '51 kazoos lie all over Sedona. Every 17 you find gives one more canteen sip.'),
  'f1.bridge': L('fifty', 'Gabe used to hike here. He sent one photo. Three years ago.'),
  'f1.card': L('fifty', 'Still no answer, Gabe.'),

  /* ---------------- I1 ---------------- */
  'i1.fleet': L('gabe', 'From Canyon Fleet? On 89A?'),
  'i1.keep': L('gabe', 'Keep going.'),

  /* ---------------- F2 The Jeep Tour (Red Jersey) ---------------- */
  'f2.phone': L('redjersey', 'New phone. Three test shots. Then we ride.'),
  'f2.welcome': L('gabe', 'Welcome to Sunburst Jeep Tours. Keep your hands in the... oh no.'),
  'f2.card': L('fifty', "You didn't send the card back."),
  'f2.later': L('gabe', 'Tour first. Talk later.'),
  'f2.film': L('redjersey', "I'm filming the whole ride. For the group chat."),
  'f2.race': L('gabe', 'Race you down. Loser buys the tacos.'),
  'f2.stop': L('redjersey', 'Hey! Why did you stop?'),
  'f2.sorry': L('gabe', 'Sorry. Something came up.'),

  /* ---------------- I2 ---------------- */
  'i2.delete': L('gabe', 'You filmed me. Delete it.'),
  'i2.post': L('redjersey', "I didn't post it. I promise."),

  /* ---------------- F3 Ronin Night Out (Tank Top) ---------------- */
  'f3.rules': L('fifty', 'Costumes stay on till Sunday. House rules.'),
  'f3.silly': L('shades', 'We look ridiculous.'),
  'f3.great': L('tanktop', 'We look amazing.'),
  'f3.cheat': L('shades', 'He moved the eight ball. I saw it.'),
  'f3.samurai': L('rattler', 'You calling me a cheat, samurai?'),
  'f3.ronin': L('all', 'Ronin.'),
  'f3.ring': L('fifty', 'Hey! My ring!'),
  'f3.get': L('rattler', 'Get them.'),
  'f3.fob': L('newbalance', "I had two sodas. I'm driving."),

  /* ---------------- I3 ---------------- */
  'i3.foam': L('gabe', 'You fought Rattler Pruitt. With foam swords.'),
  'i3.ring': L('fifty', 'He took my ring.'),
  'i3.back': L('gabe', "Then we'll get it back."),

  /* ---------------- F4 The Morning After (Fifty-One) ---------------- */
  'f4.head': L('fifty', 'My head. Where is everybody?'),
  'f4.creek': L('newbalance', 'I forgot the parking brake. I never forget the parking brake.'),
  'f4.bumper': L('tanktop', 'The bumper fell off.'),
  'f4.leave': L('fifty', 'Leave it. Look around.'),
  'f4.dice': L('shades', "We don't have fuzzy dice."),
  'f4.tag': L('newbalance', 'This tag says 4471. Ours was 4417.'),
  'f4.box': L('tanktop', 'A steel box. Heavy. Locked.'),
  'f4.text1': L('phone', 'BEAR at the bridge again.'),
  'f4.text2': L('phone', 'Handle it.'),
  'f4.text3': L('phone', '1st. 3AM. Midgley.'),
  'f4.flash': L('shades', "A flash photo. That's Gabe. On a ledge. In neon."),
  'f4.rj': L('fifty', 'Red Jersey is gone. His last photos show the Uptown clock.'),
  'f4.rail': L('fifty', 'Then a bridge rail over the creek.'),
  'f4.found': L('shades', 'Found him. He is hugging a flamingo.'),
  'f4.sunrise': L('redjersey', 'I saw the sunrise. It was very important.'),
  'f4.theory': L('shades', "BEAR at the bridge. He's with them."),
  'f4.police': L('newbalance', 'We should call the police.'),
  'f4.first': L('fifty', 'Then I want to hear him say it. The first is tonight.'),

  /* ---------------- I4 ---------------- */
  'i4.box': L('voice', "Box isn't in the van."),
  'i4.what': L('gabe', '(What box?)'),

  /* ---------------- F5 Ronin Night (Shades) ---------------- */
  'f5.ours': L('shades', "That's our van. So what are we driving?"),
  'f5.soap': L('redjersey', 'BRING IT BACK. Bring what back?'),
  'f5.lose': L('newbalance', 'Pickup and a black SUV. They want the box.'),
  'f5.hide': L('tanktop', 'The hot tub cover. Nobody looks there.'),
  'f5.lot': L('fifty', 'Midgley lot. We wait. We see who comes.'),
  'f5.figure': L('newbalance', "Someone's up on that ledge."),
  'f5.roar': L('redjersey', 'Was that a bear?'),
  'f5.flash': L('tanktop', "He's taking pictures of our van."),
  'f5.shot': L('shades', 'Got him. Neon. On the Perch.'),
  'f5.drive': L('gabe', 'Get back in your van and drive away.'),
  'f5.bear': L('pick', 'Not until you tell us about the Bear.', { tanktop: 'Not until you tell us about the Bear, pal.' }),
  'f5.iam': L('gabe', 'I am the Bear.'),

  /* ---------------- I5 ---------------- */
  'i5.leave': L('voice', 'Leave it. Find the box.'),
  'i5.back': L('gabe', "They'll come back for that box. And for you."),
  'i5.sorry': L('tanktop', 'Is this where you say sorry for the bear thing?'),
  'i5.foam': L('gabe', 'You hit me with a foam sword for ten minutes.'),
  'i5.longer': L('pick', 'It felt longer.'),

  /* ---------------- P1 Dawn Patrol ---------------- */
  'p1.drive': L('newbalance', "I've been up twenty-two hours. You drive."),
  'p1.driveNB': L('shades', "You're the careful one, New Balance. You drive."),
  'p1.start': L('pick', 'Okay, Gabe. From the start.', { tanktop: 'Talk, big guy. We are listening.', fifty: 'Start at the start, Gabe. All of it.', shades: 'Start talking, Gabe. All of it.', newbalance: 'Slowly, Gabe. From the start.', redjersey: 'Okay. Story time. From the start.' }),
  'p1.g1': L('gabe', 'Sunline Staffing posts job ads. Resort work. Good pay.'),
  'p1.g2': L('gabe', 'People come. Sunline takes their phones and IDs. For safekeeping.'),
  'p1.g3': L('gabe', 'Then they work at a ranch up FR 9. Nobody pays them.'),
  'p1.g4': L('gabe', 'The vans move people on the first of the month. At night.'),
  'p1.g5': L('gabe', "Once a month I meet an FBI agent. She says, 'Not enough yet.'"),
  'p1.wall': L('gabe', 'Two photos. Same minute. Wrong people.'),
  'p1.neon': L('gabe', 'So drivers see me on 89A at night. And so they know the Bear is watching.'),
  'p1.why1': L('gabe', 'I drove jeep tours past that lot every first of the month.'),
  'p1.why2': L('gabe', 'Same vans. Same hour. I started writing plates down.'),
  'p1.card': L('gabe', "Your wedding is on the first. I can't leave the bridge on the first."),
  'p1.cut': L('tanktop', 'Bolt cutters. Stand back.'),
  'p1.ids': L('shades', 'IDs. Ten of them. And a note.'),
  'p1.note': L('note', 'HELP. RANCH. FR 9. 10 OF US. DANA.'),
  'p1.ten': L('gabe', "Ten. They're alive. And they're asking."),
  'p1.plan': L('fifty', 'New plan.'),
  'p1.wrong': L('shades', "I was wrong about you. I'm working on it."),
  'p1.staff': L('gabe', 'Hit things with it. Only bad things.'),
  'p1.bear': L('tanktop', 'You turned into a bear.'),
  'p1.water': L('gabe', 'Sedona does that. Drink more water.'),

  /* ---------------- P2 Pie and Photos ---------------- */
  'p2.five': L('vance', 'Gabe. You brought five samurai.'),
  'p2.ronin': L('all', 'Ronin.'),
  'p2.need': L('vance', 'I need a face, a place, and a date.'),
  'p2.how': L('vance', 'Photos. From far away. Then you call me. You do not play hero.'),
  'p2.hero': L('tanktop', 'What if we play hero a little?'),
  'p2.arrest': L('vance', 'Then I arrest you a little.'),
  'p2.rule1': L('vance', 'The people they hold are not a story for your party.'),
  'p2.rule2': L('vance', 'They are people who want to go home.'),
  'p2.van': L('vance', "It's theirs? Keep driving it. To them, you're one of theirs."),
  'p2.call': L('vance', 'You call me first. Every time.'),

  /* ---------------- P3 Sunline (FACE) ---------------- */
  'p3.plan': L('shades', 'Red Jersey goes in for the open call. We watch from the van.'),
  'p3.clerk': L('clerk', 'Leave your phone and your ID with us.'),
  'p3.keep': L('redjersey', "I'll keep my phone."),
  'p3.here': L('gabe', "White hat. Cane. That's Voss."),
  'p3.how': L('voss', 'How many this month?'),
  'p3.four': L('gang', 'Four.'),
  'p3.cost': L('voss', 'Good. Labor is our biggest cost.'),
  'p3.got': L('shades', 'Face. Clear. He never stops smiling.'),

  /* ---------------- P4 Tail ---------------- */
  'p4.tail': L('gabe', "Stay back. He checks his mirrors. He's done this for years."),
  'p4.turn': L('redjersey', "He's turning onto FR 9."),
  'p4.park': L('newbalance', 'Park at the turnout. We walk from here.'),
  'p4.sign': L('shades', 'Hart Ranch. No trespassing. That is half a place.'),

  /* ---------------- P5 The Long Lens ---------------- */
  'p5.pipe': L('gabe', 'Take the pipe. People run from bears.'),
  'p5.hike': L('gabe', 'Ridge trail. Quiet feet. We watch from the top.'),
  'p5.lens': L('shades', 'Long lens. From up here I can read the padlock.'),
  'p5.list': L('gabe', 'Bunkhouse door. Van plates. A guard. The generator shed.'),
  'p5.patrol': L('gabe', 'Flashlight. Coming up the trail. Get low.'),
  'p5.marks': L('shades', 'Their routes are in the photos now.'),

  /* ---------------- P6 Rattler (DATE) ---------------- */
  'p6.end': L('fifty', 'I thought getting married meant the end of this.'),
  'p6.never': L('tanktop', 'This never ends. It just needs a bigger van.'),
  'p6.ten': L('newbalance', 'It seats ten.'),
  'p6.know': L('all', 'We know.'),
  'p6.post': L('redjersey', 'Can I post this?'),
  'p6.no': L('all', 'No.'),
  'p6.want': L('rattler', 'I want my van, my box, and my Bear.'),
  'p6.ring': L('fifty', "That was my grandpa's."),
  'p6.keepers': L('rattler', 'Finders keepers.'),
  'p6.weepers': L('tanktop', 'Losers weepers.'),
  'p6.photos': L('vance', 'I said photos.'),
  'p6.text1': L('phone', 'SUNDAY BLOWN. BEAR AND FIVE SAMURAI. NEW DATE TUE 3AM MIDGLEY.'),
  'p6.text2': L('phone', '4 NEW. MOVE THE RANCH SOUTH AFTER.'),
  'p6.key': L('vance', 'And a key to a white van. Your van, I think. I keep it for now.'),
  'p6.bed': L('vance', 'That is a date. Good work. Now go to bed.'),

  /* ---------------- P7 Vortex Monday ---------------- */
  'p7.view': L('redjersey', 'Everybody says you feel something up here.'),
  'p7.best': L('fifty', 'Will you be my best man?'),
  'p7.ask': L('gabe', 'Ask me when this is over.'),
  'p7.bride': L('phone', 'Go do the right thing. Then come home.'),
  'p7.photo': L('redjersey', 'Group photo. Ten second timer. Run!'),
  'p7.call1': L('vance', 'Voss knows we have Rattler. He is moving everyone tonight. Early.'),
  'p7.call2': L('vance', 'The judge signs at eight a.m. My agents move now.'),
  'p7.call3': L('vance', 'I need eyes on the road. Watch it. Do not go near that ranch.'),
  'p7.road': L('newbalance', "So we don't go near the ranch. We go near the road."),

  /* ---------------- P8 Plant the Phone ---------------- */
  'p8.van': L('gabe', "Sunline van at pump four. You're a gang van too. Park beside it."),
  'p8.take': L('redjersey', 'Take it. It has eleven thousand followers.'),
  'p8.plant': L('shades', 'Wheel well. Tape. Done.'),
  'p8.dot': L('newbalance', 'The convoy is a dot on the map now.'),
  'p8.call': L('vance', 'I see it too. We watch it together.'),

  /* ---------------- P9 The Convoy ---------------- */
  'p9.whale': L('vance', 'Your van. Try not to hit anything.'),
  'p9.bags': L('newbalance', 'Trash bags on the windows. One mirror. She is beautiful.'),
  'p9.moves': L('radio', 'The convoy is moving. SUV, one white van, one pickup.'),
  'p9.rule': L('', 'Do not touch the white van. There are people inside.'),
  'p9.careful': L('newbalance', "Careful isn't the same as scared."),
  'p9.pickup': L('shades', 'The pickup is out. Only the van and the SUV now.'),
  'p9.jeep': L('redjersey', "Gabe's jeep. On the bridge. Sideways."),
  'p9.uturn': L('shades', 'The SUV is turning back. Let him go. The van matters.'),
  'p9.follow': L('newbalance', 'Follow it in. Slow. Like parking.'),
  'p9.runs': L('tanktop', 'The driver is running!'),
  'p9.hey': L('tanktop', "Hey. You're okay. We're friends of the Bear."),
  'p9.dana1': L('dana', 'I am Dana. I wrote the note.'),
  'p9.dana2': L('dana', "There are six more at the ranch. He's going back for them."),
  'p9.gabe': L('gabe', 'I will drive them to Vance. Go.'),
  'p9.radio': L('vance', 'My team is minutes out. Watch the ranch road. Stay out of sight.'),

  /* ---------------- P10 The Hart Ranch ---------------- */
  'p10.suv': L('newbalance', "Voss's SUV just went up FR 9. He is moving them now."),
  'p10.now': L('fifty', 'Vance is minutes out. They could be gone in minutes.'),
  'p10.go': L('shades', 'We keep them safe till she gets here. Ridge route.'),
  'p10.gen': L('gabe', 'The generator shed. Cut it, and they see half as far.'),
  'p10.dark': L('redjersey', 'Lights out.'),
  'p10.boone': L('boone', 'Somebody get the lights.'),
  'p10.keys': L('shades', 'Boone had the keys.'),
  'p10.gentle': L('tanktop', 'Strong is easy. Gentle is the hard part.'),
  'p10.safe': L('tanktop', "Hey. Dana sent us. You're safe. Nobody has to hurry."),
  'p10.whale': L('newbalance', "The Whale is at the gate. Engine's running."),
  'p10.signal': L('fifty', 'We move when I wave. Cover to cover.'),
  'p10.lightsOn': L('shades', "Headlights. That's Voss."),

  /* ---------------- P11 The Scorpion ---------------- */
  'p11.long': L('voss', 'You boys are a long way from home.'),
  'p11.so': L('pick', 'So are they.'),
  'p11.contract': L('voss', 'They signed a contract.'),
  'p11.note': L('fifty', 'They wrote a note.'),
  'p11.prove': L('voss', "You can't prove a thing."),
  'p11.photos': L('shades', 'Gabe has four hundred photos. I have forty.'),
  'p11.guard': L('tanktop', "I'll stay. Nobody touches anybody."),
  'p11.guardNB': L('newbalance', "You drive. I'll stay. Nobody touches anybody."),

  /* ---------------- P12 Ten Seats ---------------- */
  'p12.seats': L('newbalance', 'Six in the back. Four of us. Every seat is full.'),
  'p12.slow': L('fifty', 'Drive smooth. Nobody needs another bump tonight.'),
  'p12.thanks': L('passenger', 'Thank you.'),
  'p12.radio': L('vance', 'Pickup at the junction. We have it. Keep driving.'),
  'p12.told': L('vance', 'I told you not to go near that ranch.'),
  'p12.in': L('gabe', "They didn't go near it. They went in it."),
  'p12.wait': L('vance', 'Next time, you wait for us.'),
  'p12.thank': L('vance', 'You watched. You called. You kept them safe till we got there.'),
  'p12.month': L('vance', 'Same time next month, Gabe?'),
  'p12.wedding': L('gabe', 'Next month, the first is a wedding.'),
  'p12.ring': L('fifty', 'Best man holds the ring.'),
  'p12.lose': L('gabe', "Then I'd better not lose it."),
  'p12.find': L('tanktop', "We'd find it."),

  /* ---------------- E1 The First ---------------- */
  'e1.gift': L('note', 'For the ten seats. Dana.'),
  'e1.alone': L('gabe', "I did this alone for seven months. I don't have to anymore."),
  'e1.ringOn': L('gabe', 'Ring. Still here. I checked forty times.'),
  'e1.photo': L('redjersey', 'Last one. Kasa hats on. Ten second timer.'),
  'e1.ten': L('newbalance', 'Ten seats.'),
  'e1.know': L('all', 'We know.'),
  'e1.post': L('redjersey', 'Not posting it. Some things are just for us.'),
  'e1.plan': L('fifty', 'The plan was never the point. You were.'),

  /* ---------------- side content (E9): Legends, time trials, photo hunts ---------------- */
  'side.cairn': L('', 'The cairn hums. Ink pools around the stones. Something guards it.'),
  'side.javelina': L('', 'Tusks in the ink. THE JAVELINA guards the Airport Mesa cairn.'),
  'side.vulture': L('', 'Wings in the ink. THE VULTURE guards the Bell Rock cairn.'),
  'side.gila': L('', 'Beads in the ink. THE GILA guards the Cathedral cairn.'),
  'side.tarantula': L('', 'Legs in the ink. THE TARANTULA guards the Boynton cairn.'),
  'side.legendDone': L('', 'The ink drains away. The cairn is quiet.'),
  'side.trialJeep': L('guide', 'Sunburst Jeep Tours time trial. Beat the clock to the bottom.'),
  'side.trialCanyon': L('guide', 'Canyon run. Bridge to Slide Rock. The clock is running.'),
  'side.trialDone': L('guide', 'Nice driving. Your time is on the board.'),
  'side.huntUptown': L('redjersey', 'Photo hunt. Three Uptown shots for the album.'),
  'side.huntCanyon': L('redjersey', 'Photo hunt. The canyon from three good spots.'),
  'side.huntRocks': L('redjersey', 'Photo hunt. Three famous rocks. Get them all in frame.'),
  'side.huntDone': L('redjersey', 'Album done. Not posting it. Probably.'),
};

// the lines some pieces show outside the dialogue box (cards, toasts, hints); text.mjs lints them too
export const UI_TEXT = {
  titleNote: 'A story about friendship. It also deals with human trafficking. No one who is held is hurt on screen.',
  hotline: 'If you see signs of trafficking, do not step in yourself. Call 1-888-373-7888. Text HELP to 233733. Outside the US, call your local police.',
  closing: 'No bears were harmed. Gabe is fine. Gabe is the best man.',
};
