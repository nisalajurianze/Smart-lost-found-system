import LostItem from '../models/LostItem.js';
import FoundItem from '../models/FoundItem.js';
import ClaimRequest from '../models/ClaimRequest.js';
import Match from '../models/Match.js';
import Notification from '../models/Notification.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  expandKeywords,
  confidenceForScore,
  inferIntent,
  isGreetingOnly,
  isPersonalQuery,
  isSearchFollowUp,
  reportTypeForLookup,
  resolveConversationLanguage,
  resolveConversationStyle,
  resolveSearchMessage,
  scoreCandidate,
  isReportRequest,
} from '../services/chatSearchService.js';
import { buildConversationalReportDraft } from '../services/conversationalReportService.js';
import { inspectAIInput } from '../services/aiSafetyService.js';
import { applyAssistantSessionTurn, readAssistantSessionForSearch } from '../services/conversationStateService.js';
import { buildRecoveryGuidance, isRecoveryQuery } from '../services/recoveryGuidanceService.js';
import { correctSearchText } from '../services/spellingCorrectionService.js';
import { rerankHybridCandidate } from '../services/semanticSearchService.js';
import { answerKnowledgeQuery, isKnowledgeQuery } from '../services/knowledgeAssistantService.js';

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 12;
const MAX_CANDIDATES_PER_MODEL = 120;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const copy = {
  en: {
    greeting: 'Hi! Are you looking for something you lost, or would you like to report an item you found?',
    help: 'I can help you search for a lost item, report a found item, review possible matches, or build a report draft step by step.',
    ask: 'Please add an item name, colour, brand, category, or location so I can search accurately.',
    none: 'No close match yet. Try the item name, colour, or a more specific location.',
    noneLost: 'No matching lost-item report yet. You can still file a found-item report.',
    noneFound: 'No matching found-item report yet. Try another detail, or file a lost-item report.',
    results: (count) => `${count} possible ${count === 1 ? 'match' : 'matches'}. Open a report to check the details.`,
    resultsLost: (count) => `${count} possible ${count === 1 ? 'match in lost-item reports' : 'matches in lost-item reports'}. If you found the same item, open that report to let the reporter know.`,
    resultsFound: (count) => `${count} possible ${count === 1 ? 'match in found-item reports' : 'matches in found-item reports'}. Check the details before claiming an item as yours.`,
    signIn: 'Please sign in to view your reports, claims, matches, and unread notifications.',
    personal: 'Here is your current Smart L&F activity.',
    saySomething: 'Please say something.',
    tooLong: 'Please keep the message under 500 characters.',
    unsafe: 'I cannot process instructions that request hidden prompts, credentials, or safety bypasses. Please describe the lost or found item only.',
    reportStart: 'Okay — let’s create the report step by step. Was the item lost or found?',
    reportFoundIntro: 'Let’s draft a found-item report.',
    reportLostIntro: 'Let’s draft a lost-item report.',
    foundHandover: 'Report the found item and say where it is being kept. If you see a matching lost-item report, open it to let the reporter know and arrange a safe handover through Smart L&F.',
    reportReady: 'Your report details are ready. Review the draft and submit it when everything is correct.',
    reportContinue: 'Let’s finish the report details first. I will not search public reports while we are collecting them.',
  },
  singlish: {
    greeting: 'Hi! Oya nathi una deyak hoyanawada, nathnam hambuna item ekak report karanawada?',
    help: 'Mama oyata nathi una item ekak hoyanna, hambuna item ekak report karanna, possible matches balanna, saha report draft eka step-by-step hadanna udaw karannam.',
    ask: 'Hariyata hoyanna item eke nama, paata, brand eka, category eka hari location eka hari denna.',
    none: 'Galapena report ekak thama hambune na. Item eke nama, paata, nathnam hari thana kiyanna.',
    noneLost: 'Galapena lost report ekak thama na. Oya hoyagaththa item eka found report ekak widiyata danna puluwan.',
    noneFound: 'Galapena found report ekak thama na. Thawa detail ekak kiyanna, nathnam lost report ekak danna.',
    results: (count) => `Galapenna puluwan reports ${count}k thiyenawa. Report eka arala details balanna.`,
    resultsLost: (count) => `Galapenna puluwan lost reports ${count}k thiyenawa. Oya hoyagaththa item eka nam, e report eka arala report karapu kenata danwanna.`,
    resultsFound: (count) => `Galapenna puluwan found reports ${count}k thiyenawa. Oyagema item eka da kiyala details balala claim karanna.`,
    signIn: 'Oyage reports, claims, matches saha unread notifications balanna sign in wenna.',
    personal: 'Oyage danata thiyena Smart L&F activity eka meka.',
    saySomething: 'Message ekak type karanna.',
    tooLong: 'Message eka characters 500kata aduwen thiyanna.',
    unsafe: 'Hidden prompts, credentials, safety bypass instructions process karanna ba. Lost hari found item eke details witharak denna.',
    reportStart: 'Hari, report eka step-by-step hadamu. Item eka nathi una da, nathnam hambuna da?',
    reportFoundIntro: 'Hari, oya hoyagaththa item eka report karamu.',
    reportLostIntro: 'Hari, oyage nathi una item eka report karamu.',
    foundHandover: 'Hambuna item eka report karala, dan koheda thiyenne kiyanna. Galapena lost report ekak thiyenawa nam, eka arala report karapu kenata danwanna. Smart L&F haraha arakshithawa bara denna.',
    reportReady: 'Report eke details tika ready. Draft eka balala hari nam submit karanna.',
    reportContinue: 'Mulin report eke details tika iwara karamu. Details collect karana athara public reports hoyanne na.',
  },
  si: {
    greeting: 'ආයුබෝවන්! ඔබ නැති වූ දෙයක් සොයනවාද, නැත්නම් හමුවූ භාණ්ඩයක් වාර්තා කරනවාද?',
    help: 'නැති වූ භාණ්ඩයක් සෙවීමට, හමුවූ භාණ්ඩයක් වාර්තා කිරීමට, ගැළපීම් බැලීමට හෝ වාර්තා කෙටුම්පතක් පියවරෙන් පියවර සෑදීමට මට උදව් කළ හැක.',
    ask: 'නිවැරදිව සොයන්න භාණ්ඩයේ නම, පාට, brand එක, category එක හෝ ස්ථානයක් දෙන්න.',
    none: 'ගැළපෙන වාර්තාවක් තවම හමු වුණේ නැහැ. භාණ්ඩයේ නම, පාට හෝ නිශ්චිත ස්ථානය කියන්න.',
    noneLost: 'ගැළපෙන නැතිවූ වාර්තාවක් තවම නැහැ. හමුවූ භාණ්ඩය ගැන වාර්තාවක් දාන්න පුළුවන්.',
    noneFound: 'ගැළපෙන හමුවූ වාර්තාවක් තවම නැහැ. තවත් විස්තරයක් කියන්න, නැත්නම් නැතිවූ වාර්තාවක් දාන්න.',
    results: (count) => `ගැළපිය හැකි වාර්තා ${count}ක් තියෙනවා. වාර්තාව විවෘත කර විස්තර බලන්න.`,
    resultsLost: (count) => `ගැළපිය හැකි නැතිවූ වාර්තා ${count}ක් තියෙනවා. ඔබට හමුවුණේ ඒ භාණ්ඩය නම්, අදාළ වාර්තාව විවෘත කර වාර්තා කළ කෙනාට දන්වන්න.`,
    resultsFound: (count) => `ගැළපිය හැකි හමුවූ වාර්තා ${count}ක් තියෙනවා. හිමිකම් ඉල්ලීමට පෙර විස්තර බලන්න.`,
    signIn: 'ඔබගේ reports, claims, matches සහ unread notifications බලන්න sign in වෙන්න.',
    personal: 'ඔබගේ Smart L&F activity එක මෙන්න.',
    saySomething: 'කරුණාකර පණිවිඩයක් ලියන්න.',
    tooLong: 'පණිවිඩය අක්ෂර 500කට අඩුවෙන් තබන්න.',
    unsafe: 'සැඟවුණු prompts, credentials හෝ safety bypass උපදෙස් සැකසිය නොහැක. නැතිවූ හෝ හමුවූ භාණ්ඩයේ විස්තර පමණක් දෙන්න.',
    reportStart: 'හරි, වාර්තාව පියවරෙන් පියවර සකස් කරමු. භාණ්ඩය නැති වුණාද, හමු වුණාද?',
    reportFoundIntro: 'හරි, ඔබට හමුවූ භාණ්ඩය ගැන වාර්තාවක් හදමු.',
    reportLostIntro: 'හරි, ඔබට නැතිවූ භාණ්ඩය ගැන වාර්තාවක් හදමු.',
    foundHandover: 'හමුවූ භාණ්ඩය වාර්තා කර දැන් එය තබා තිබෙන තැන සඳහන් කරන්න. ගැළපෙන නැතිවූ වාර්තාවක් තිබේ නම් එය විවෘත කර වාර්තා කළ කෙනාට දන්වා ආරක්ෂිතව භාර දෙන්න.',
    reportReady: 'වාර්තාවේ විස්තර සූදානම්. කෙටුම්පත සමාලෝචනය කර නිවැරදි නම් ඉදිරිපත් කරන්න.',
    reportContinue: 'මුලින් වාර්තාවේ විස්තර සම්පූර්ණ කරමු. ඒවා එකතු කරන අතර public reports සොයන්නේ නැහැ.',
  },
  ta: {
    greeting: 'வணக்கம்! நீங்கள் தொலைத்த பொருளை தேடுகிறீர்களா, அல்லது கண்டெடுத்த பொருளை பதிவு செய்ய விரும்புகிறீர்களா?',
    help: 'தொலைந்த பொருளைத் தேட, கண்டெடுத்த பொருளைப் பதிவு செய்ய, சாத்தியமான பொருத்தங்களைப் பார்க்க அல்லது அறிக்கை வரைவை படிப்படியாக உருவாக்க நான் உதவ முடியும்.',
    ask: 'துல்லியமாக தேட பொருளின் பெயர், நிறம், brand, category அல்லது இடத்தைச் சேர்க்கவும்.',
    none: 'பொருந்தும் பதிவு இன்னும் கிடைக்கவில்லை. பொருளின் பெயர், நிறம் அல்லது சரியான இடத்தைச் சொல்லுங்கள்.',
    noneLost: 'பொருந்தும் தொலைந்த பொருள் பதிவு இன்னும் இல்லை. நீங்கள் கண்டெடுத்த பொருளைப் பதிவுசெய்யலாம்.',
    noneFound: 'பொருந்தும் கண்டெடுத்த பொருள் பதிவு இன்னும் இல்லை. மேலும் ஒரு விவரத்தைச் சொல்லுங்கள் அல்லது தொலைந்த பொருளைப் பதிவுசெய்யுங்கள்.',
    results: (count) => `பொருந்தக்கூடிய ${count} பதிவுகள் உள்ளன. பதிவைத் திறந்து விவரங்களைப் பாருங்கள்.`,
    resultsLost: (count) => `பொருந்தக்கூடிய ${count} தொலைந்த பொருள் பதிவுகள் உள்ளன. அதே பொருளைக் கண்டெடுத்திருந்தால், சம்பந்தப்பட்ட பதிவைத் திறக்கவும்.`,
    resultsFound: (count) => `பொருந்தக்கூடிய ${count} கண்டெடுத்த பொருள் பதிவுகள் உள்ளன. உரிமை கோரும் முன் விவரங்களைச் சரிபார்க்கவும்.`,
    signIn: 'உங்கள் reports, claims, matches மற்றும் unread notifications பார்க்க sign in செய்யவும்.',
    personal: 'உங்கள் தற்போதைய Smart L&F activity இதோ.',
    saySomething: 'தயவுசெய்து ஒரு செய்தியை எழுதவும்.',
    tooLong: 'செய்தியை 500 எழுத்துகளுக்குள் வைத்திருக்கவும்.',
    unsafe: 'மறைக்கப்பட்ட prompts, credentials அல்லது safety bypass வழிமுறைகளை செயலாக்க முடியாது. தொலைந்த அல்லது கண்டெடுத்த பொருளின் விவரங்களை மட்டும் வழங்கவும்.',
    reportStart: 'சரி, அறிக்கையை படிப்படியாக உருவாக்கலாம். பொருள் தொலைந்ததா அல்லது கிடைத்ததா?',
    reportFoundIntro: 'நீங்கள் கண்டெடுத்த பொருளுக்கான அறிக்கை வரைவைத் தொடங்குவோம்.',
    reportLostIntro: 'நீங்கள் தொலைத்த பொருளுக்கான அறிக்கை வரைவைத் தொடங்குவோம்.',
    foundHandover: 'கண்டெடுத்த பொருளையும் அது இப்போது வைக்கப்பட்டுள்ள இடத்தையும் பதிவுசெய்யுங்கள். பொருந்தும் தொலைந்த பொருள் பதிவு இருந்தால், அதைப் பதிவுசெய்தவருக்கு அறிவித்து பாதுகாப்பாக ஒப்படையுங்கள்.',
    reportReady: 'அறிக்கை விவரங்கள் தயாராக உள்ளன. வரைவை மதிப்பாய்வு செய்து சரியாக இருந்தால் சமர்ப்பிக்கவும்.',
    reportContinue: 'முதலில் அறிக்கை விவரங்களை முடிப்போம். அவற்றை சேகரிக்கும் போது பொது பதிவுகளைத் தேடமாட்டேன்.',
  },
};

const quickReplies = {
  en: {
    greeting: ['Lost a black phone', 'Found a wallet', 'My reports'],
    ask: ['Black phone', 'Blue wallet', 'Laptop near library'],
    search: ['Search for an item'],
  },
  singlish: {
    greeting: ['Kalu phone ekak nathi una', 'Wallet ekak hambuna', 'Mage reports'],
    ask: ['Kalu phone ekak', 'Nil wallet ekak', 'Library eka laga laptop ekak'],
    search: ['Item ekak hoyanna'],
  },
  si: {
    greeting: ['කළු දුරකථනයක් නැති වුණා', 'පසුම්බියක් හමු වුණා', 'මගේ වාර්තා'],
    ask: ['කළු දුරකථනයක්', 'නිල් පසුම්බියක්', 'පුස්තකාලය අසල ලැප්ටොප් එකක්'],
    search: ['භාණ්ඩයක් සොයන්න'],
  },
  ta: {
    greeting: ['கருப்பு தொலைபேசி தொலைந்தது', 'பணப்பை கிடைத்தது', 'என் பதிவுகள்'],
    ask: ['கருப்பு தொலைபேசி', 'நீல பணப்பை', 'நூலகம் அருகே மடிக்கணினி'],
    search: ['ஒரு பொருளை தேடவும்'],
  },
};

const q = (style, key) => quickReplies[style]?.[key] ?? quickReplies.en[key];

const actionLabels = {
  en: { reportLost: 'Report lost item', reportFound: 'Report found item', signIn: 'Sign in', reports: 'My lost reports', claims: 'My claims', matches: 'My matches', notifications: 'Notifications' },
  singlish: { reportLost: 'Nathi una item eka report karanna', reportFound: 'Hambuna item eka report karanna', signIn: 'Sign in wenna', reports: 'Mage lost reports', claims: 'Mage claims', matches: 'Mage matches', notifications: 'Notifications' },
  si: { reportLost: 'නැති වූ භාණ්ඩය වාර්තා කරන්න', reportFound: 'හමුවූ භාණ්ඩය වාර්තා කරන්න', signIn: 'පිවිසෙන්න', reports: 'මගේ නැති වූ වාර්තා', claims: 'මගේ හිමිකම් ඉල්ලීම්', matches: 'මගේ ගැළපීම්', notifications: 'දැනුම්දීම්' },
  ta: { reportLost: 'தொலைந்த பொருளை பதிவு செய்யவும்', reportFound: 'கண்டெடுத்த பொருளை பதிவு செய்யவும்', signIn: 'உள்நுழையவும்', reports: 'என் தொலைந்த பதிவுகள்', claims: 'என் உரிமைக் கோரிக்கைகள்', matches: 'என் பொருத்தங்கள்', notifications: 'அறிவிப்புகள்' },
};

const actionLabel = (style, key) => actionLabels[style]?.[key] ?? actionLabels.en[key];

const reportAction = (style, type) => ({
  type: `report_${type}`,
  label: actionLabel(style, type === 'found' ? 'reportFound' : 'reportLost'),
  url: `/dashboard/report-${type}`,
});

const isGeneralHelpQuery = (value) => {
  const text = String(value || '').normalize('NFKC').toLowerCase();
  const asksForHelp = /\b(?:help|udaw|udau)\b/u.test(text) || /උදව්|உதவி/u.test(text);
  const hasItemContext = inferIntent(text) !== 'search' || /\b(?:phone|mobile|bag|wallet|laptop|mouse|key|book|umbrella|watch)\b/u.test(text);
  return asksForHelp && !hasItemContext;
};

const itemEmojiRules = [
  [/\b(microphone|mic|mics)\b/i, '🎙️'],
  [/\b(phone|mobile|iphone|android)\b/i, '📱'],
  [/\b(bag|backpack|schoolbag)\b/i, '🎒'],
  [/\b(wallet|purse)\b/i, '👛'],
  [/\b(mouse)\b/i, '🖱️'],
  [/\b(laptop|notebook|computer)\b/i, '💻'],
  [/\b(key|keys|keychain)\b/i, '🔑'],
  [/\b(id|identity|student card|bank card)\b/i, '🪪'],
  [/\b(book|books|textbook)\b/i, '📚'],
  [/\b(earphone|earphones|headphone|headphones|earbuds)\b/i, '🎧'],
  [/\b(umbrella)\b/i, '☂️'],
  [/\b(watch|smartwatch)\b/i, '⌚'],
];

export const withRelevantItemEmoji = (reply, reportDraft = null, items = []) => {
  const text = String(reply || '').trim();
  if (!text || /\p{Extended_Pictographic}/u.test(text)) return text;
  const context = [
    reportDraft?.fields?.itemName,
    reportDraft?.fields?.category,
    ...(!reportDraft?.fields?.itemName ? items.slice(0, 3).flatMap((item) => [item?.itemName, item?.category]) : []),
  ].filter(Boolean).join(' ');
  if (!context) return text;
  const emoji = itemEmojiRules.find(([pattern]) => pattern.test(context))?.[1] || '🔎';
  return `${text} ${emoji}`;
};

const t = (language, key, ...args) => {
  const value = copy[language]?.[key] ?? copy.en[key];
  return typeof value === 'function' ? value(...args) : value;
};

const publicItem = (item, itemType, scored) => ({
  _id: item._id,
  itemType,
  itemName: item.itemName,
  category: item.category,
  description: String(item.description || '').slice(0, 260),
  location: item.lostLocation || item.foundLocation || '',
  date: item.lostDate || item.foundDate || item.createdAt,
  image: item.images?.[0]?.url || '',
  status: item.status,
  relevanceScore: scored.score,
  confidence: scored.confidence,
  reasons: scored.reasons,
  url: itemType === 'FoundItem' ? `/found-items/${item._id}` : `/lost-items/${item._id}`,
  claimUrl: itemType === 'FoundItem' ? `/found-items/${item._id}?claim=1` : `/lost-items/${item._id}?claim=1`,
});

const candidateQuery = (statuses, terms) => {
  const fields = ['itemName', 'category', 'description', 'tags', 'aiKeywords', 'lostLocation', 'foundLocation'];
  const clauses = [];
  for (const term of terms.slice(0, 24)) {
    const regex = new RegExp(escapeRegex(term), 'i');
    for (const field of fields) clauses.push({ [field]: regex });
  }
  return {
    status: { $in: statuses },
    isDeleted: { $ne: true },
    isArchived: { $ne: true },
    ...(clauses.length ? { $or: clauses } : {}),
  };
};

const searchModel = async (Model, itemType, statuses, searchMessage, terms) => {
  const projection = 'itemName category description brand model colors uniqueFeatures lostLocation foundLocation lostDate foundDate images status createdAt tags aiKeywords';
  const baseQuery = { status: { $in: statuses }, isDeleted: { $ne: true }, isArchived: { $ne: true } };
  const [lexicalCandidates, recentCandidates] = await Promise.all([
    Model.find(candidateQuery(statuses, terms)).select(projection).sort({ createdAt: -1 }).limit(MAX_CANDIDATES_PER_MODEL).lean(),
    Model.find(baseQuery).select(projection).sort({ createdAt: -1 }).limit(MAX_CANDIDATES_PER_MODEL).lean(),
  ]);
  const candidates = [...new Map([...lexicalCandidates, ...recentCandidates].map((item) => [String(item._id), item])).values()];

  return candidates
    .map((item) => {
      const lexical = scoreCandidate(item, searchMessage, terms);
      const hybrid = rerankHybridCandidate(item, searchMessage, lexical);
      return { item, scored: { ...lexical, ...hybrid, confidence: confidenceForScore(hybrid.score) } };
    })
    .filter(({ scored }) => scored.score >= 18)
    .map(({ item, scored }) => publicItem(item, itemType, scored));
};

const personalSummary = async (userId) => {
  const [lostReports, foundReports, pendingClaims, totalClaims, suggestedMatches, unreadNotifications] = await Promise.all([
    LostItem.countDocuments({ userId, isArchived: { $ne: true } }),
    FoundItem.countDocuments({ userId, isArchived: { $ne: true } }),
    ClaimRequest.countDocuments({ claimantId: userId, status: 'pending' }),
    ClaimRequest.countDocuments({ claimantId: userId }),
    Match.countDocuments({ $or: [{ lostUserId: userId }, { foundUserId: userId }], status: 'suggested' }),
    Notification.countDocuments({ userId, isRead: false }),
  ]);
  return { lostReports, foundReports, pendingClaims, totalClaims, suggestedMatches, unreadNotifications };
};

export const handleAIChat = asyncHandler(async (req, res) => {
  const rawIncoming = String(req.body?.message || '').normalize('NFKC').trim();
  const history = (Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [])
    .filter((entry) => ['user', 'assistant', 'ai'].includes(entry?.role) && typeof entry?.content === 'string')
    .map((entry) => {
      const inspected = inspectAIInput(entry.content, { maxLength: 500 });
      return { role: entry.role, content: inspected.safe ? inspected.redactedText : '[blocked unsafe message]' };
    });
  const locale = ['en', 'si', 'ta'].includes(req.body?.locale) ? req.body.locale : 'en';
  const preferredStyle = ['en', 'si', 'ta', 'singlish'].includes(req.body?.conversationStyle) ? req.body.conversationStyle : '';
  const responseStyle = resolveConversationStyle(rawIncoming, history, locale, preferredStyle);
  if (!rawIncoming) return ApiResponse.ok({ text: t(responseStyle, 'saySomething'), responseStyle, quickReplies: q(responseStyle, 'greeting'), items: [] }).send(res);
  const inspectedInput = inspectAIInput(rawIncoming, { maxLength: 500 });
  if (inspectedInput.issues.includes('INPUT_TOO_LONG')) return ApiResponse.ok({ text: t(responseStyle, 'tooLong'), responseStyle, quickReplies: [], items: [] }).send(res);
  if (!inspectedInput.safe) {
    return ApiResponse.ok({
      text: t(responseStyle, 'unsafe'),
      responseStyle,
      quickReplies: q(responseStyle, 'ask'),
      items: [],
      meta: { safety: 'blocked', safetyVersion: inspectedInput.version },
    }).send(res);
  }
  const incoming = inspectedInput.redactedText;

  const language = resolveConversationLanguage(incoming, history);
  const initialIntent = inferIntent(incoming);
  if (isGreetingOnly(incoming)) {
    return ApiResponse.ok({
      text: t(responseStyle, 'greeting'),
      language,
      responseStyle,
      quickReplies: q(responseStyle, 'greeting'),
      items: [],
      actions: [{ type: 'report_lost', label: actionLabel(responseStyle, 'reportLost'), url: '/dashboard/report-lost' }, { type: 'report_found', label: actionLabel(responseStyle, 'reportFound'), url: '/dashboard/report-found' }],
    }).send(res);
  }

  if (isPersonalQuery(incoming)) {
    if (!req.user?._id) {
      return ApiResponse.ok({ text: t(responseStyle, 'signIn'), language, responseStyle, quickReplies: [], items: [], actions: [{ type: 'sign_in', label: actionLabel(responseStyle, 'signIn'), url: '/login' }] }).send(res);
    }
    const summary = await personalSummary(req.user._id);
    return ApiResponse.ok({
      text: t(responseStyle, 'personal'), language, responseStyle, personalSummary: summary, items: [], quickReplies: q(responseStyle, 'search'),
      actions: [
        { type: 'reports', label: actionLabel(responseStyle, 'reports'), url: '/dashboard/my-lost' },
        { type: 'claims', label: actionLabel(responseStyle, 'claims'), url: '/dashboard/claims' },
        { type: 'matches', label: actionLabel(responseStyle, 'matches'), url: '/dashboard/my-matches' },
        { type: 'notifications', label: actionLabel(responseStyle, 'notifications'), url: '/dashboard/notifications' },
      ],
    }).send(res);
  }

  if (isGeneralHelpQuery(incoming)) {
    return ApiResponse.ok({
      text: t(responseStyle, 'help'),
      language,
      responseStyle,
      quickReplies: q(responseStyle, 'greeting'),
      items: [],
      actions: [
        { type: 'report_lost', label: actionLabel(responseStyle, 'reportLost'), url: '/dashboard/report-lost' },
        { type: 'report_found', label: actionLabel(responseStyle, 'reportFound'), url: '/dashboard/report-found' },
      ],
    }).send(res);
  }

  if (isRecoveryQuery(incoming)) {
    if (initialIntent === 'found' && !reportTypeForLookup(incoming)) {
      return ApiResponse.ok({ text: t(responseStyle, 'foundHandover'), language, responseStyle, intent: 'found', items: [], quickReplies: [], actions: [reportAction(responseStyle, 'found')] }).send(res);
    }
    const summary = req.user?._id ? await personalSummary(req.user._id) : {};
    const guidance = buildRecoveryGuidance({ responseStyle, authenticated: Boolean(req.user?._id), summary });
    const labels = {
      sign_in: actionLabel(responseStyle, 'signIn'),
      claims: actionLabel(responseStyle, 'claims'),
      matches: actionLabel(responseStyle, 'matches'),
      search: q(responseStyle, 'search')[0],
    };
    return ApiResponse.ok({
      text: guidance.text,
      language: resolveConversationLanguage(incoming, history),
      responseStyle,
      quickReplies: [],
      items: [],
      actions: guidance.actions.map((action) => ({ ...action, label: labels[action.type] })),
      recovery: { state: req.user?._id ? 'authenticated' : 'awaiting-auth', safetyNotice: guidance.safetyNotice },
      meta: { source: 'Verified Smart L&F recovery policy', notice: 'AI guidance does not prove ownership or approve a claim.' },
    }).send(res);
  }

  if (isKnowledgeQuery(incoming)) {
    const knowledge = await answerKnowledgeQuery({
      query: incoming,
      responseStyle,
      authenticated: Boolean(req.user?._id),
      isAdmin: req.user?.role === 'admin',
    });
    if (knowledge.answered) {
      return ApiResponse.ok({
        text: knowledge.text,
        language: resolveConversationLanguage(incoming, history),
        responseStyle,
        quickReplies: [],
        items: [],
        knowledge,
        meta: { source: knowledge.citations[0]?.label, notice: 'Answer grounded in an approved, versioned source.' },
      }).send(res);
    }
  }

  const hasSessionVersion = Number(req.body?.sessionVersion) > 0;
  if (isReportRequest(incoming) && initialIntent === 'search' && !hasSessionVersion) {
    return ApiResponse.ok({
      text: t(responseStyle, 'reportStart'),
      language,
      responseStyle,
      intent: 'report',
      quickReplies: ['si', 'ta'].includes(responseStyle)
        ? (responseStyle === 'si' ? ['නැති වුණා', 'හමු වුණා'] : ['தொலைந்தது', 'கிடைத்தது'])
        : (responseStyle === 'singlish' ? ['Nathi una', 'Hambuna'] : ['I lost something', 'I found something']),
      items: [],
      actions: [
        { type: 'report_lost', label: actionLabel(responseStyle, 'reportLost'), url: '/dashboard/report-lost' },
        { type: 'report_found', label: actionLabel(responseStyle, 'reportFound'), url: '/dashboard/report-found' },
      ],
      meta: { source: 'Guided report workflow', notice: 'Report details are collected before public matching.' },
    }).send(res);
  }

  const rawSearchMessage = resolveSearchMessage(incoming, history);
  const spelling = correctSearchText(rawSearchMessage);
  let searchMessage = spelling.corrected;
  let terms = expandKeywords(searchMessage);

  const requestedPage = Number.parseInt(req.body?.page, 10);
  const requestedPageSize = Number.parseInt(req.body?.pageSize, 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Math.min(MAX_PAGE_SIZE, Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? requestedPageSize : DEFAULT_PAGE_SIZE);
  const lookupType = reportTypeForLookup(rawSearchMessage);
  const searchIntent = lookupType ? 'search' : inferIntent(searchMessage);
  const sessionId = String(req.body?.sessionId || '').trim().slice(0, 160);
  const sessionArgs = { sessionId, responseStyle, userId: req.user?._id };
  let sessionState = null;
  if (sessionId && !lookupType && (searchIntent !== 'search' || hasSessionVersion)) {
    if (page > 1 || isSearchFollowUp(incoming)) sessionState = await readAssistantSessionForSearch(sessionArgs);
    else sessionState = await applyAssistantSessionTurn({ ...sessionArgs, expectedVersion: req.body?.sessionVersion, message: incoming, intent: searchIntent });
  }
  const intent = sessionState?.reportType || searchIntent;
  const actions = intent === 'search' ? [] : [reportAction(responseStyle, intent)];
  const reportDraft = sessionState ? {
    reportType: sessionState.reportType,
    fields: sessionState.fields,
    missing: sessionState.missing,
    confidence: sessionState.completeness,
    state: sessionState.state,
    version: sessionState.version,
    changedFields: sessionState.changedThisTurn,
    source: 'Server-validated conversation slot state; human review required',
    privacyNotice: 'Remove passwords, full card numbers, private addresses and other sensitive identifiers before submission.',
  } : buildConversationalReportDraft({ message: searchMessage, intent });

  const readyToSearch = sessionState && ['itemName', 'location', 'date'].every((field) => sessionState.fields[field]);
  if (sessionState && !readyToSearch) {
    const intro = sessionState.turnCount === 1 && t(responseStyle, intent === 'found' ? 'reportFoundIntro' : 'reportLostIntro');
    const text = [intro, sessionState.question || t(responseStyle, 'reportContinue')].filter(Boolean).join(' ');
    return ApiResponse.ok({
      text: withRelevantItemEmoji(text, reportDraft),
      language,
      responseStyle,
      intent,
      query: { message: searchMessage, terms, page: 1, pageSize },
      total: 0,
      totalPages: 0,
      hasMore: false,
      quickReplies: [],
      items: [],
      actions,
      reportDraft,
      sessionState,
      corrections: spelling.corrections,
      meta: { source: 'Guided report workflow' },
    }).send(res);
  }

  if (sessionState) {
    // Search using remembered public details, never just the latest short answer
    // or private identifying marks supplied for ownership verification.
    searchMessage = ['itemName', 'colors', 'brand', 'model', 'location'].map((field) => sessionState.fields[field]).filter(Boolean).join(' ');
    terms = expandKeywords(searchMessage);
  }
  if (!terms.length) {
    return ApiResponse.ok({ text: t(responseStyle, 'ask'), language, responseStyle, quickReplies: q(responseStyle, 'ask'), items: [] }).send(res);
  }

  const inventory = lookupType || ({ lost: 'found', found: 'lost' })[intent];
  let ranked;
  if (inventory === 'found') {
    ranked = await searchModel(FoundItem, 'FoundItem', ['available', 'matched'], searchMessage, terms);
  } else if (inventory === 'lost') {
    ranked = await searchModel(LostItem, 'LostItem', ['pending', 'matched'], searchMessage, terms);
  } else {
    const [found, lost] = await Promise.all([
      searchModel(FoundItem, 'FoundItem', ['available', 'matched'], searchMessage, terms),
      searchModel(LostItem, 'LostItem', ['pending', 'matched'], searchMessage, terms),
    ]);
    ranked = [...found, ...lost];
  }

  ranked.sort((left, right) => right.relevanceScore - left.relevanceScore || new Date(right.date) - new Date(left.date));
  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const items = ranked.slice(start, start + pageSize);

  const outcome = total ? 'results' : 'none';
  const reply = t(responseStyle, `${outcome}${inventory === 'found' ? 'Found' : inventory === 'lost' ? 'Lost' : ''}`, total);
  const nextStep = sessionState && (sessionState.question || t(responseStyle, 'reportReady'));
  return ApiResponse.ok({
    text: withRelevantItemEmoji([reply, nextStep].filter(Boolean).join(' '), reportDraft, items),
    language,
    responseStyle,
    intent,
    query: { message: searchMessage, terms, page: safePage, pageSize },
    total,
    page: safePage,
    pageSize,
    totalPages: total ? totalPages : 0,
    hasMore: safePage < totalPages,
    items,
    quickReplies: [],
    reportDraft,
    sessionState,
    corrections: spelling.corrections,
    actions,
    meta: { source: 'Public Smart L&F reports', notice: 'AI relevance is a search aid, not proof of ownership.', lastUpdated: new Date().toISOString() },
  }).send(res);
});
