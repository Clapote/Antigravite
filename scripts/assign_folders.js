const fs = require('fs');
const path = require('path');

const categories = {
  "Focus, Rituals & Daily Routines": [
    "2 AM Debug Loop",
    "Brushstrokes and Rain",
    "Butter and Windowlight",
    "Chapter By Lamplight",
    "Coffee Ring Notebook",
    "Continue Screen Dreams",
    "Cursor After Midnight",
    "Dog Eared Pages",
    "Dust in the Curtains",
    "Exhale the Morning",
    "Faded Corners of the Page",
    "First Coffee Thoughts",
    "Graphite Mornings",
    "Graphite in the Quiet",
    "Hour Between Clicks",
    "Kettle Before Work",
    "Margin Notes at Dusk",
    "Mat and Morning Light",
    "Morning Pages",
    "Morning in the Hiss",
    "Pancakes in the Sun",
    "Penciled Sunbeams",
    "Pixel Quest Save Point",
    "Quiet Lungs Quiet Light",
    "Stacks of Quiet Hours",
    "Sunday Light Through Lace",
    "Sunrise Stretch Flow",
    "Terminal Rain",
    "Watercolors By the Window"
  ],
  "Seasons, Rain & Weather": [
    "A Taste of Spring",
    "After School Rain",
    "Amber Sidewalks",
    "Amber Windowpane",
    "Autumn on the Window Glass",
    "Bloom Between Showers",
    "Blossoms on the Pavement",
    "Embers After Midnight",
    "Fallen Leaves Loop",
    "Fieldnotes at Dawn",
    "Fireplace Loop",
    "Hammock in the Shade",
    "Lemonade Film Grain",
    "Mist Over Green Fields",
    "Moon Over Red Dunes",
    "Palm Breeze Nap",
    "Petals After Rain",
    "Petals in the Breeze",
    "Picnic Polaroids",
    "Sidewalk Puddles",
    "Snow on the Needle",
    "Spring Garden Loops",
    "Starlight in the Sand",
    "Storm Over Side Streets",
    "Thunder in the Dust",
    "Tide Stained Polaroids",
    "Winter Turntable"
  ],
  "Ambient Drift & Dreamscapes": [
    "Almost Floating",
    "Aurora on Mute",
    "Blue Below the Surface",
    "Cathedral Hiss",
    "Deep Space Loop",
    "Drifting Through Fog",
    "First Light on the Ridge",
    "Ghosts on the Hillside",
    "Glasshouse Ghosts",
    "Green After Midnight",
    "Misty Mountain Sunrise",
    "Moonlit Moss",
    "Orbiting in Silence",
    "Polar Afterglow",
    "Satellite Lullaby",
    "Sea Glass Evening",
    "Soft Weightless Hours",
    "Stained Glass Static",
    "Tide Pools at Twilight",
    "Underwater Dreamscape",
    "Warm Constellations"
  ],
  "Soul, Slow Jams & Warm Rooms": [
    "3AM Sink Light",
    "Barefoot in the Kitchen",
    "Candle Wax Heart",
    "Envelope on the Bed",
    "Golden Afternoon Groove",
    "Honey on the Speakers",
    "Kitchen After the Party",
    "Lazy Love Letter Afternoon",
    "Midnight Notes on the Floor",
    "Midnight Table Talk",
    "Old Photos New Heart",
    "Polaroids in A Shoebox",
    "Porcelain Heartbeat",
    "Rain on Your Hoodie",
    "Record Player Embrace",
    "Rooftop Slow Jam",
    "Scattered Sheet Music",
    "Skyline and Satin",
    "Slow Dance in the Living Room",
    "Slow Dancing By the Stove",
    "Velvet Candle Smoke"
  ],
  "Late Night, Neon & After Hours": [
    "3 AM Echoes",
    "Antenna After Midnight",
    "Blinds and Headlights",
    "Electric Puddles",
    "Elevator To the Moon",
    "Empty Street Static",
    "Half Empty Coupe",
    "Headlights on the Divider",
    "High Rise Haze",
    "Last Call at Table Nine",
    "Last Train Home",
    "Midnight Window Glow",
    "Midnight on My Mind",
    "Platform After Rain",
    "Rain Off the Neon Signs",
    "Rooftop Static Dreams",
    "Streetlights in the Rearview",
    "Warm Mile Markers"
  ],
  "Funk, Soul & Retro Bounce": [
    "Basement Groove 86",
    "Block Party Slow Jam",
    "Burnt Sunset Groove",
    "Cassette Basement Bounce",
    "Dust on the Needle",
    "Dusty Jukebox Heart",
    "Grandmas Kitchen on Sunday",
    "Mirrorball Slow Roll",
    "Motel Soul Radio",
    "Neon on the Diner Floor",
    "Peach Cobbler Static",
    "Roller Rink Reverie",
    "Smoke in the Orange Sky",
    "Summer Curbside Glow"
  ],
  "Jazz Lounge & Bookstore Grooves": [
    "Ashes in the Coffee Cup",
    "Breezy Afternoon Terrace",
    "Candlelit at 70 BPM",
    "Dust and Hardcovers",
    "Harbor Before Words",
    "Last Call in C Minor",
    "Linen and Limoncello",
    "Midnight Amber Room",
    "Rain on the Boulevard",
    "Saxophone in the Rain",
    "Stacks of Quiet Books",
    "Velvet Cigarette Haze"
  ],
  "Chillhop & Cozy Beats": [
    "Dusk Between Stoops",
    "Dust on the Morning Keys",
    "Glow on the Overpass",
    "Porchlight Golden Hour",
    "Sidewalk Slow Jam",
    "Soft Gold Sky",
    "Sunset Offbeat",
    "Window Seat Daydream"
  ],
  "Asian & Zen Lo-Fi": [
    "Bamboo Shadow Waltz",
    "Bells Before Sunrise",
    "Lanterns in Slow Motion",
    "Misty Steam Quiet Dreams",
    "Moon Through Bamboo",
    "Paper Lantern Rain",
    "Teacup Morning Fog",
    "Temple at Dawn"
  ],
  "Hybrid, World & Cinematic": [
    "Cafe Da Tarde",
    "Cassette Pastel Nights",
    "Dusk on Red Earth",
    "End Scene Glow",
    "Midnight Steam and Mango Skin",
    "Quiet Credits",
    "Savanna Slow Glow",
    "VHS Heartbeat"
  ]
};

const tracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
const tracks = JSON.parse(fs.readFileSync(tracksPath, 'utf8'));

// Build lookup map: normalize title (lowercase, no non-alphanumeric except space)
function norm(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const titleToCategory = new Map();
let totalListed = 0;
for (const [cat, titles] of Object.entries(categories)) {
  for (const t of titles) {
    titleToCategory.set(norm(t), cat);
    totalListed++;
  }
}

console.log("Total titles in categories list:", totalListed);

let matched = 0;
let unmatched = [];

for (const track of tracks) {
  const cat = titleToCategory.get(norm(track.title)) || titleToCategory.get(norm(track.filename.replace(/\.mp3$/i, '')));
  if (cat) {
    track.folder = cat;
    matched++;
  } else {
    track.folder = "Focus, Rituals & Daily Routines"; // fallback
    unmatched.push(track.title + ' (' + track.filename + ')');
  }
}

console.log(`Matched: ${matched} / ${tracks.length}`);
if (unmatched.length > 0) {
  console.log("Unmatched tracks:", unmatched);
}

fs.writeFileSync(tracksPath, JSON.stringify(tracks, null, 2), 'utf8');
console.log("Updated data/music-tracks.json successfully!");
