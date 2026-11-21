const official = 'https://www.seu.ac.lk/';
const directory = `${official}tpdirectory.php`;
const library = `${official}library/facilities.php`;
const sports = `${official}physicaleducationunit/index.php`;
const technology = 'https://seu.ac.lk/ft/downloads/Handbook_2019_2020.pdf';
const engineering = `${official}fe/contact.php`;
const campusId = 'seusl-oluvil-main';

const campusPlaces = (category, sourceReference, entries, parentId = campusId) => entries.map(([id, name, aliases]) => ({
  id: `seusl-${id}`,
  canonicalName: `SEUSL ${name}`,
  aliases,
  category,
  area: 'Oluvil Campus',
  parentId,
  verificationStatus: 'university-approved',
  sensitivity: 'public',
  sourceType: 'university',
  sourceReference,
}));

// Building and service names are documented at campus or parent-facility level.
const campusDirectory = [
  ...campusPlaces('auditorium', `${official}news/index.php?fun=shownews&id=230602`, [
    ['main-auditorium', 'Main Auditorium', ['main auditorium', 'university auditorium', 'main hall', 'ප්‍රධාන ශ්‍රවණාගාරය', 'பிரதான அரங்கம்']],
  ]),
  ...campusPlaces('auditorium', `${official}news/index.php?fun=shownews&id=161008`, [
    ['fia-auditorium', 'FIA Auditorium', ['islamic faculty auditorium', 'fia auditorium']],
  ], 'seusl-fia'),
  ...campusPlaces('library facility', library, [
    ['library-study-room', '24-Hour Study Room', ['24 hours study room', '24 hour library study room', 'open learning commons', 'group study room', 'study room']],
    ['library-cyber-centre', 'Library Cyber Centre', ['cyber centre', 'cyber center', 'library computers']],
    ['library-sri-lanka-collection', 'Library Sri Lanka Collection', ['sri lanka collection', 'ex libris']],
    ['library-leisure-reading', 'Library Leisure Reading Area', ['leisure reading', 'library reading area']],
  ], 'seusl-library'),
  ...campusPlaces('museum', `${official}library/museum/location.php`, [
    ['cultural-museum', 'Cultural Museum', ['seu museum', 'library museum', 'cultural museum', 'කෞතුකාගාරය', 'அருங்காட்சியகம்']],
  ], 'seusl-library'),
  ...campusPlaces('library facility', `${official}library/membership.php`, [
    ['library-circulation', 'Library Circulation Counter', ['circulation counter', 'library issue desk', 'library returns counter']],
  ], 'seusl-library'),
  ...campusPlaces('canteen', `${official}downloads/sustainability/Smart%20Building%20Implementation%20at%20SEUSL.pdf`, [
    ['hela-bojun', 'Hela Bojun Canteen', ['hela bojun', 'hela bojun hala', 'හෙළ බොජුන්', 'හෙළ බොජුන් හල']],
  ], 'seusl-cafeteria-zone'),
  ...campusPlaces('health centre', `${official}faq.php`, [
    ['medical-centre', 'University Medical Centre', ['medical center', 'medical centre', 'university health centre', 'campus clinic', 'වෛද්‍ය මධ්‍යස්ථානය', 'மருத்துவ நிலையம்']],
  ]),
  ...campusPlaces('student services', directory, [
    ['student-welfare', 'Student Support Services and Welfare', ['student welfare', 'student support', 'sssw', 'welfare office']],
    ['career-guidance', 'Career Guidance Unit', ['career guidance unit', 'career guidance office', 'cgu']],
    ['external-degrees', 'Centre for External Degrees and Professional Learning', ['cedpl', 'external degrees centre']],
  ]),
  ...campusPlaces('student services', `${official}sssw/`, [
    ['student-registration', 'Student Services and Registration Division', ['student registration office', 'student services and registration', 'student registration division']],
    ['marshal-unit', 'Marshal Unit', ['marshal office', 'university marshal']],
  ]),
  ...campusPlaces('administrative office', directory, [
    ['vice-chancellor-office', 'Vice Chancellor’s Office', ['vc office', 'vice chancellor office']],
    ['registrar-office', 'Registrar’s Office', ['registrar office', 'registrar']],
    ['bursar-office', 'Bursar’s Office', ['bursar office', 'bursar']],
    ['examinations-office', 'Examination Division', ['exam branch', 'exam office', 'examination division']],
    ['establishments-office', 'Establishments Division', ['establishment branch', 'establishments division']],
  ]),
  ...campusPlaces('administrative office', `${official}financialadmin/index.php`, [
    ['accounts-budget', 'Accounts and Budget Division', ['accounts office', 'accounts and budget division']],
    ['payments-division', 'Payments Division', ['payments office', 'payments division']],
    ['salaries-division', 'Salaries Division', ['salary division', 'salaries office']],
    ['procurement-division', 'Procurement Division', ['procurement office', 'procurement division']],
    ['stores-division', 'Store and Suppliers Division', ['store and suppliers division', 'supplies office']],
  ]),
  ...campusPlaces('campus centre', `${official}universitylife/recreationcenter/index.php`, [
    ['recreation-centre', 'Students’ Recreation Centre', ['recreation centre', 'recreation center', 'student rec centre']],
  ]),
  ...campusPlaces('sports facility', sports, [
    ['physical-education', 'Physical Education Unit', ['physical education unit', 'sports office']],
    ['sports-ground', 'Sports Grounds', ['playground', 'play ground', 'campus ground', 'sports ground', 'ක්‍රීඩා පිටිය', 'விளையாட்டு மைதானம்']],
    ['weightlifting-gym', 'Weightlifting Gymnasium', ['weight lifting gymnasium', 'weightlifting gym']],
    ['taekwondo-gym', 'Taekwondo Gymnasium', ['taekwondo gym', 'taekwondo hall']],
    ['badminton-court', 'Badminton Court', ['badminton court', 'badminton hall']],
    ['table-tennis-court', 'Table Tennis Court', ['table tennis court', 'table tennis hall']],
    ['tennis-court', 'Tennis Court', ['tennis court', 'lawn tennis court']],
    ['netball-court', 'Netball Court', ['netball court', 'netball ground']],
    ['basketball-court', 'Basketball Court', ['basketball court', 'basketball ground']],
    ['swimming-pool', 'Swimming Pool', ['swimming pool', 'campus pool', 'පිහිනුම් තටාකය', 'நீச்சல் குளம்']],
  ]),
  ...campusPlaces('engineering department', engineering, [
    ['civil-engineering', 'Department of Civil Engineering', ['civil engineering department', 'civil engineering']],
    ['mechanical-engineering', 'Department of Mechanical Engineering', ['mechanical engineering department', 'mechanical engineering']],
    ['electrical-engineering', 'Department of Electrical and Telecommunication Engineering', ['electrical and telecommunication engineering', 'electrical engineering department', 'dete']],
    ['computer-science-engineering', 'Department of Computer Science and Engineering', ['computer science engineering department', 'computer science and engineering', 'dcse']],
    ['interdisciplinary-studies', 'Department of Interdisciplinary Studies', ['inter disciplinary studies', 'interdisciplinary studies department']],
  ], 'seusl-fe'),
  ...campusPlaces('arts department', `${official}fac/`, [
    ['arts-social-sciences', 'FAC Department of Social Sciences', ['social sciences department', 'fac social sciences']],
    ['arts-languages', 'FAC Department of Languages', ['department of languages', 'fac languages department']],
    ['arts-geography', 'FAC Department of Geography', ['geography department', 'fac geography']],
    ['arts-political-science', 'FAC Department of Political Science', ['political science department', 'fac political science']],
    ['arts-economics-statistics', 'FAC Department of Economics and Statistics', ['economics and statistics department', 'fac economics']],
    ['arts-english-language-teaching', 'FAC Department of English Language Teaching', ['english language teaching department', 'delt']],
    ['arts-sociology', 'FAC Department of Sociology', ['sociology department', 'fac sociology']],
    ['arts-it', 'FAC Department of Information Technology', ['fac it department', 'arts it department', 'fac it lab']],
  ], 'seusl-fac'),
  ...campusPlaces('management department', `${official}fmc/introduction.php`, [
    ['fmc-deans-office', 'FMC Dean’s Office', ['fmc dean office', 'management faculty dean office']],
    ['fmc-accountancy-finance', 'Department of Accountancy and Finance', ['accountancy and finance department', 'fmc accounting department']],
    ['fmc-management', 'FMC Department of Management', ['department of management', 'fmc management department']],
    ['fmc-management-it', 'Department of Management and Information Technology', ['management and it department', 'fmc mit department']],
    ['fmc-computer-unit', 'FMC Computer Unit', ['fmc computer lab', 'management faculty computer unit']],
  ], 'seusl-fmc'),
  ...campusPlaces('islamic studies department', `${official}fia/`, [
    ['fia-islamic-studies', 'Department of Islamic Studies', ['islamic studies department', 'fia islamic studies']],
    ['fia-arabic-language', 'Department of Arabic Language', ['arabic language department', 'fia arabic department']],
  ], 'seusl-fia'),
  ...campusPlaces('technology facility', technology, [
    ['biosystems-technology', 'Department of Biosystems Technology', ['biosystems technology', 'bst department', 'dbst']],
    ['information-communication-technology', 'Department of Information and Communication Technology', ['ft ict department', 'information and communication technology department', 'dict']],
    ['technology-auditorium', 'Technology Faculty Auditorium', ['ft auditorium', 'technology faculty auditorium', 'tech auditorium']],
    ['technology-labs', 'Technology Faculty Laboratories', ['ft labs', 'tech faculty labs', 'technology labs']],
    ['technology-lecture-halls', 'Technology Faculty Lecture Halls', ['ft lecture halls', 'technology lecture hall']],
  ], 'seusl-ft'),
];

export default campusDirectory;
