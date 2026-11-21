const campus = 'Oluvil Campus';
const village = 'Oluvil';
const division = 'Addalachchenai, Ampara';
const census = 'https://www.statistics.gov.lk/Resource/en/Population/CPH_2024/GN_housing_pdf.pdf';
const schools = 'https://moe.gov.lk/wp-content/uploads/2025/07/School_List.pdf';

const localPlace = ({ id, canonicalName, category, area, aliases = [], sourceReference, sourceType, sensitivity = 'public', parentId }) => ({
  id, canonicalName, category, area, aliases, sourceReference, sourceType, sensitivity, parentId,
  administrativeArea: division,
  verificationStatus: 'map-source-verified',
});

// OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright
// Named features selected from the Oluvil area snapshot, not a street geometry export.
const mapped = (category, area, entries) => entries.map(([id, canonicalName, object, aliases, options]) => localPlace({
  id, canonicalName, category, area, aliases,
  sourceType: 'public-map',
  sourceReference: `https://www.openstreetmap.org/${object}`,
  parentId: area === campus ? 'seusl-oluvil-main' : undefined,
  ...options,
}));

const campusMap = [
  ...mapped('campus road', campus, [
    ['seusl-admin-road', 'SEUSL Admin Road', 'way/592626762', ['admin road', 'administration road']],
  ]),
  ...mapped('campus landmark', campus, [
    ['seusl-bus-stand', 'SEUSL Bus Stand', 'node/6267498283', ['campus bus stop', 'university bus stand', 'university bus stop', 'seusl bus stop']],
    ['seusl-post-office', 'SEUSL University Post Office', 'node/11399755216', ['campus post office', 'university post office']],
    ['seusl-vehicle-park', 'SEUSL Vehicle Park', 'way/332227623', ['campus car park', 'university parking', 'vehicle park']],
    ['seusl-sports-centre', 'SEUSL Sports Centre', 'node/11618147004', ['sports centre', 'sports center']],
    ['seusl-fia-canteen', 'SEUSL FIA Faculty Canteen', 'node/11445772425', ['fia canteen', 'islamic faculty canteen'], { parentId: 'seusl-fia' }],
  ]),
  ...mapped('place of worship', campus, [
    ['seusl-mosque', 'SEUSL University Mosque', 'node/10660577419', ['campus mosque', 'university mosque', 'பல்கலைக்கழக பள்ளிவாசல்']],
    ['seusl-chapel', 'SEUSL University Chapel', 'way/1233452727', ['university chapel', 'campus church']],
    ['seusl-kovil', 'SEUSL University Kovil', 'way/1229240199', ['university kovil', 'campus kovil']],
    ['seusl-buddhist-temple', 'SEUSL University Temple', 'way/592626760', ['buddhist temple', 'campus temple', 'university temple']],
  ]),
];

const roads = [
  ...mapped('road', village, [
    ['a4-oluvil', 'A4 Pottuvil–Batticaloa Road', 'way/760436005', ['a4', 'a4 road', 'pottuvil batticaloa road', 'kalmunai akkaraipattu road', 'colombo batticaloa highway']],
    ['seusl-road', 'SEUSL Road', 'way/332230262', ['university approach road', 'seu road', 'campus road']],
    ['oluvil-harbour-road', 'Oluvil Harbour Road', 'way/324909463', ['harbour road', 'harbor road', 'port road']],
    ['oluvil-lighthouse-street', 'Oluvil Lighthouse Street', 'way/178088790', ['lighthouse street', 'lighthouse road', 'light house road']],
    ['oluvil-hospital-road', 'Oluvil Hospital Road', 'way/1568246062', ['hospital road']],
    ['oluvil-mahapola-road', 'Oluvil Mahapola Road', 'way/592546918', ['mahapola road']],
    ['oluvil-masjith-road', 'Oluvil Masjith Road', 'way/324922115', ['masjith road', 'masjid road']],
    ['oluvil-bangala-road', 'Oluvil Bangala Road', 'way/1420084283', ['bangala road']],
    ['oluvil-cross-01', 'Oluvil 1st Cross Street', 'way/766593715', ['1st cross', '1 cross', 'first cross street']],
    ['oluvil-cross-02', 'Oluvil 2nd Cross Street', 'way/766593714', ['2nd cross', '2 cross', 'second cross street']],
    ['oluvil-cross-03', 'Oluvil 3rd Cross Street', 'way/592548636', ['3rd cross', '3 cross', 'third cross street']],
    ['oluvil-cross-04', 'Oluvil 4th Cross Street', 'way/324915322', ['4th cross', '4 cross', 'fourth cross street']],
    ['oluvil-cross-05', 'Oluvil 5th Cross Street', 'way/1333265977', ['5th cross', '5 cross', 'fifth cross street']],
    ['oluvil-cross-06', 'Oluvil 6th Cross Street', 'way/1201493108', ['6th cross', '6 cross', 'sixth cross street']],
    ['oluvil-cross-07', 'Oluvil 7th Cross Street', 'way/592623694', ['7th cross', '7 cross', 'seventh cross street']],
    ['oluvil-cross-08', 'Oluvil 8th Cross Street', 'way/1568246055', ['8th cross', '8 cross', 'eighth cross street']],
    ['oluvil-kaliyodai-bridge', 'Kaliyodai Bridge', 'way/228885150', ['kaliyodai bridge', 'kaliyodai palama']],
  ]),
  ...mapped('road', 'Palamunai area', [
    ['border-road', 'Border Road', 'way/324909217', ['palamunai border road']],
    ['drainage-road', 'Drainage Road', 'way/324909216', ['palamunai drainage road']],
    ['haji-road', 'Haji Road', 'way/324909218', ['palamunai haji road']],
    ['husainiya-nagar-road', 'Husainiya Nagar Road', 'way/324909900', ['hussainiya nagar road']],
    ['old-post-office-road', 'Old Post Office Road', 'way/324909221', ['palamunai old post office road']],
    ['sahfa-madrisa-road', 'Sahfa Madrisa Road', 'way/592549776', ['sahfa madrasa road']],
    ['sinna-palamunai-road', 'Sinna Palamunai Road', 'way/324738986', ['sinna palamune road']],
  ]),
];

const landmarks = [
  ...mapped('village', village, [
    ['oluvil-village', 'Oluvil Village', 'node/3315921296', ['oluvil', 'olivil', 'ඔලුවිල්', 'ஒலுவில்'], { sensitivity: 'zone-only' }],
  ]),
  ...mapped('village landmark', village, [
    ['oluvil-hospital', 'Oluvil Hospital', 'way/1568246065', ['oluvil government hospital', 'oluvil hospital eka', 'ඔලුවිල් රෝහල', 'ஒலுவில் வைத்தியசாலை']],
    ['oluvil-post-office', 'Oluvil Post Office', 'node/11140103447', ['oluvil post office eka', 'ඔලුවිල් තැපැල් කාර්යාලය', 'ஒலுவில் தபால் நிலையம்']],
    ['oluvil-public-library', 'Oluvil Public Library', 'way/592542152', ['town library', 'village library', 'ஒலுவில் பொது நூலகம்', 'ඔලුවිල් මහජන පුස්තකාලය']],
    ['oluvil-lighthouse', 'Oluvil Lighthouse', 'node/2908448926', ['oluvil light house', 'oluvil lighthouse tower', 'ඔලුවිල් ප්‍රදීපාගාරය']],
    ['oluvil-harbour', 'Oluvil Harbour', 'way/287212920', ['oluvil harbor', 'oluvil port', 'ඔලුවිල් වරාය', 'ஒலுவில் துறைமுகம்']],
    ['oluvil-public-beach', 'Oluvil Public Beach', 'way/1229666850', ['oluvil beach', 'ඔලුවිල් වෙරළ', 'ஒலுவில் கடற்கரை']],
    ['oluvil-hamra-ground', 'Hamra Ground', 'way/1497575005', ['hamra playground']],
    ['oluvil-hamra-school', 'Hamra National School', 'way/1568246056', ['hamra school']],
  ]),
  ...mapped('place of worship', village, [
    ['oluvil-grand-mosque', 'Oluvil Grand Jumma Masjid', 'way/1568246064', ['oluvil grand mosque', 'grand jumma masjith', 'grand jumma masjid oluvil']],
    ['oluvil-an-noor-mosque', 'An-Noor Masjith', 'way/592630007', ['an noor mosque']],
    ['oluvil-ansari-mosque', 'Ansari Mosque', 'node/11140093875', ['ansari masjid']],
    ['oluvil-aksha-mosque', 'Beach Aksha Mosque', 'way/1500648071', ['beach aqsa mosque']],
    ['oluvil-habbani-mosque', 'Habbani Mosque', 'node/11140478779', ['habbani masjid']],
  ]),
  ...mapped('village landmark', 'Palamunai', [
    ['palamunai-hospital', 'Palamunai Hospital', 'way/1568040804', ['palamune hospital']],
    ['palamunai-beach-park', 'Palamunai Beach Park', 'way/532139363', ['palamunai beach', 'palamune beach']],
    ['palamunai-grand-mosque', 'Palamunai Grand Jumma Masjid', 'node/3314164003', ['palamunai grand mosque']],
    ['palamunai-ibnu-seena', 'Ibnu Seena Vidyalaya', 'way/1568041107', ['ibnu seena school']],
  ]),
];

const publishedAddresses = [
  ['oluvil-main-street', 'Oluvil Main Street', 'road', ['oluvil main road', 'main street oluvil', 'ஒலுவில் பிரதான வீதி', 'ඔලුවිල් ප්‍රධාන වීදිය']],
  ['oluvil-al-madeena', 'Al-Madeena Vidyalaya', 'school', ['aal matheena vidyalaya', 'al madeena school']],
  ['oluvil-al-minara', 'Al-Minara Vidyalaya', 'school', ['al minara school']],
].map(([id, canonicalName, category, aliases]) => localPlace({
  id, canonicalName, category, aliases, area: village, sourceReference: schools, sourceType: 'government',
}));

const oluvilDivisions = ['AD/35', 'AD/35B', 'AD/35C', 'AD/35E', 'AD/35C/1', 'AD/35C/2', 'AD/35C/3']
  .map((code, index) => {
    const number = index + 1;
    return localPlace({
      id: `oluvil-gn-${number}`, canonicalName: `Oluvil 0${number} GN Division`, category: 'GN division',
      area: `Oluvil 0${number}`, aliases: [`oluvil 0${number}`, `oluvil ${number}`, `ඔලුවිල් 0${number}`, `ஒலுவில் 0${number}`, code],
      sourceReference: census, sourceType: 'government', sensitivity: 'zone-only',
    });
  });

export default [...campusMap, ...oluvilDivisions, ...roads, ...publishedAddresses, ...landmarks];
