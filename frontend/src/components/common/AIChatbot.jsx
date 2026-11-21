import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiChevronRight,
  FiClock,
  FiMic,
  FiMessageSquare,
  FiMoreHorizontal,
  FiPackage,
  FiPlus,
  FiSearch,
  FiSend,
  FiSquare,
  FiTrash2,
  FiUsers,
  FiVolume2,
  FiX,
} from 'react-icons/fi';
import { FaRobot } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  clearAssistantConversations,
  createAssistantConversation,
  loadAssistantConversations,
  removeAssistantConversation,
  saveAssistantConversations,
} from '../../utils/assistantHistory';
import { isSafeInternalPath, toSafeInternalPath } from '../../utils/internalNavigation';
import { saveAssistantReportDraft } from '../../utils/assistantReportDraft';
import { resolveSpeechSettings, selectSpeechVoice, speechStyleLocale } from '../../utils/speech';

const timestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const initialMessage = (t) => ({
  role: 'ai',
  content: t('assistant.initial'),
  timestamp: timestamp(),
  items: [],
  actions: [],
});

const confidenceLabel = (confidence, t) => ({
  high: t('assistant.highRelevance'),
  medium: t('assistant.mediumRelevance'),
  possible: t('assistant.possibleMatch'),
}[confidence] || t('assistant.aiRelevance'));

const voiceOptions = (t) => [
  { value: 'auto', label: t('assistant.voiceAuto') },
  { value: 'en-US', label: t('assistant.voiceEnglish') },
  { value: 'si-LK', label: t('assistant.voiceSinhala') },
  { value: 'ta-LK', label: t('assistant.voiceTamil') },
];

const DEFAULT_QUICK_REPLIES = ['I lost something', 'I found something', 'My reports'];
const COMPACT_ASSISTANT = '(max-width: 639px)';
const CHAT_ICON_BUTTON = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-surface-600 hover:bg-surface-100 focus-visible:outline-2 focus-visible:outline-primary-500 dark:text-surface-300 dark:hover:bg-surface-800';
const CHAT_OPTION = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-surface-800 hover:bg-surface-100 disabled:opacity-50 dark:text-surface-100 dark:hover:bg-surface-800';
const isSafeCitationUrl = (value) => isSafeInternalPath(value) || /^https:\/\/(?:www\.)?seu\.ac\.lk(?:\/|$)/iu.test(String(value || ''));

const focusConversation = (dialog, input) => {
  const manualInput = window.matchMedia(`${COMPACT_ASSISTANT}, (pointer: coarse)`).matches;
  const target = manualInput ? dialog : input || dialog;
  target?.focus({ preventScroll: true });
};

const fitComposer = (input) => {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
};

const REPORT_DRAFT_COPY = {
  en: {
    title: (type) => `Reviewable ${type} report draft`, confidence: (value) => `Detected confidence: ${value}%`, review: 'Human review required',
    item: 'Item', category: 'Category', colour: 'Colour', location: 'Location', dateTime: 'Date/time', stillNeeded: 'Still needed:',
    privacy: 'Remove passwords, full card numbers, private addresses and other sensitive identifiers before submission.', open: 'Open guided report and review fields',
    updated: 'Updated', complete: 'complete', types: { lost: 'lost', found: 'found' }, missing: {},
  },
  singlish: {
    title: (type) => `Balala confirm karanna puluwan ${type} report draft eka`, confidence: (value) => `Detect karapu confidence eka: ${value}%`, review: 'Manually balanna one',
    item: 'Item eka', category: 'Category eka', colour: 'Paata', location: 'Thana', dateTime: 'Dawasa/welawa', stillNeeded: 'Thawa one:',
    privacy: 'Submit karanna kalin passwords, full card numbers, private addresses saha sensitive details ain karanna.', open: 'Guided report eka arala details balanna',
    updated: 'Update kala', complete: 'complete', types: { lost: 'nathi una', found: 'hambuna' }, missing: { 'item name': 'item eke nama', category: 'category eka', 'specific location': 'hari thana', 'date/time': 'dawasa/welawa', 'one unique identifying feature': 'wenama handunaganna lakunayak' },
  },
  si: {
    title: (type) => `සමාලෝචනය කළ හැකි ${type} වාර්තා කෙටුම්පත`, confidence: (value) => `හඳුනාගත් විශ්වාසය: ${value}%`, review: 'මානව සමාලෝචනය අවශ්‍යයි',
    item: 'භාණ්ඩය', category: 'කාණ්ඩය', colour: 'වර්ණය', location: 'ස්ථානය', dateTime: 'දිනය/වේලාව', stillNeeded: 'තව අවශ්‍යයි:',
    privacy: 'ඉදිරිපත් කිරීමට පෙර මුරපද, සම්පූර්ණ කාඩ් අංක, පුද්ගලික ලිපින සහ සංවේදී තොරතුරු ඉවත් කරන්න.', open: 'මාර්ගෝපදේශිත වාර්තාව විවෘත කර විස්තර සමාලෝචනය කරන්න',
    updated: 'යාවත්කාලීන කළා', complete: 'සම්පූර්ණයි', types: { lost: 'නැති වූ', found: 'හමුවූ' }, missing: { 'item name': 'භාණ්ඩයේ නම', category: 'කාණ්ඩය', 'specific location': 'නිශ්චිත ස්ථානය', 'date/time': 'දිනය/වේලාව', 'one unique identifying feature': 'එක් විශේෂ හඳුනාගැනීමේ ලක්ෂණයක්' },
  },
  ta: {
    title: (type) => `மதிப்பாய்வு செய்யக்கூடிய ${type} அறிக்கை வரைவு`, confidence: (value) => `கண்டறிந்த நம்பிக்கை: ${value}%`, review: 'மனித மதிப்பாய்வு தேவை',
    item: 'பொருள்', category: 'வகை', colour: 'நிறம்', location: 'இடம்', dateTime: 'தேதி/நேரம்', stillNeeded: 'இன்னும் தேவை:',
    privacy: 'சமர்ப்பிக்கும் முன் கடவுச்சொற்கள், முழு அட்டை எண்கள், தனிப்பட்ட முகவரிகள் மற்றும் முக்கிய தகவல்களை அகற்றவும்.', open: 'வழிகாட்டப்பட்ட அறிக்கையைத் திறந்து விவரங்களை மதிப்பாய்வு செய்யவும்',
    updated: 'புதுப்பிக்கப்பட்டது', complete: 'நிறைவு', types: { lost: 'தொலைந்த', found: 'கண்டெடுத்த' }, missing: { 'item name': 'பொருளின் பெயர்', category: 'வகை', 'specific location': 'குறிப்பிட்ட இடம்', 'date/time': 'தேதி/நேரம்', 'one unique identifying feature': 'ஒரு தனிப்பட்ட அடையாள அம்சம்' },
  },
};

const AssistantResultCard = ({ item, closeAssistant, t }) => (
  <article className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm dark:border-surface-600 dark:bg-surface-800">
    <div className="flex gap-3 p-3">
      {item.image ? (
        <img src={item.image} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" loading="lazy" />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-400 dark:bg-surface-700" aria-hidden="true">
          <FiSearch className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
            {item.itemType === 'FoundItem' ? t('assistant.found') : t('assistant.lost')}
          </span>
          <span className="text-xs font-semibold text-surface-500 dark:text-surface-300">
            {confidenceLabel(item.confidence, t)} · {item.relevanceScore}%
          </span>
        </div>
        <h4 className="mt-1 truncate text-base font-semibold text-surface-900 dark:text-white">{item.itemName}</h4>
        <p className="mt-1 line-clamp-2 text-sm text-surface-600 dark:text-surface-300">{item.location || item.description}</p>
      </div>
    </div>
    {item.reasons?.length > 0 && (
      <details className="border-t border-surface-100 px-3 py-1 dark:border-surface-700">
        <summary className="min-h-10 cursor-pointer content-center text-xs font-semibold text-surface-600 dark:text-surface-300">{t('assistant.whyAppeared')}</summary>
        <ul className="mt-1 space-y-0.5 text-xs text-surface-500 dark:text-surface-400">
          {item.reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
        </ul>
      </details>
    )}
    <div className="grid grid-cols-2 border-t border-surface-200 dark:border-surface-700">
      <Link
        to={toSafeInternalPath(item.url, '/search')}
        onClick={closeAssistant}
        className="flex min-h-11 items-center justify-between border-r border-surface-200 px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:border-surface-700 dark:text-primary-300 dark:hover:bg-surface-700"
      >
        {t('assistant.viewReport')} <FiChevronRight aria-hidden="true" />
      </Link>
      <Link
        to={toSafeInternalPath(item.claimUrl, item.url)}
        onClick={closeAssistant}
        className="flex min-h-11 items-center justify-center px-3 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-surface-700"
      >
        {t(item.itemType === 'FoundItem' ? 'detail.thisMine' : 'detail.iHaveThis')}
      </Link>
    </div>
  </article>
);


const ReportDraftCard = ({ draft, onStart, onApprove, isSubmitting, canApprove, responseStyle, t }) => {
  if (!draft?.fields) return null;
  const copy = REPORT_DRAFT_COPY[responseStyle] || REPORT_DRAFT_COPY.en;
  const dateLocale = responseStyle === 'si' ? 'si-LK' : responseStyle === 'ta' ? 'ta-LK' : 'en-LK';
  const details = [
    [copy.item, draft.fields.itemName],
    [copy.category, draft.fields.category],
    [copy.colour, draft.fields.colors],
    [copy.location, draft.fields.location],
    [copy.dateTime, draft.fields.date ? new Date(draft.fields.date).toLocaleString(dateLocale) : ''],
  ].filter(([, value]) => value);
  const localizedMissing = draft.missing?.map((entry) => copy.missing[entry] || entry) || [];
  return (
    <section className="mt-3 w-full rounded-2xl border border-primary-200 bg-primary-50/70 p-4 dark:border-primary-900/60 dark:bg-primary-950/25" aria-label={t('assistant.draftAria')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">{copy.title(copy.types[draft.reportType] || draft.reportType)}</p>
          <p className="mt-1 text-sm text-surface-700 dark:text-surface-200">{copy.confidence(draft.confidence)}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-primary-700 shadow-sm dark:bg-surface-900 dark:text-primary-300">{copy.review}</span>
      </div>
      {details.length > 0 && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {details.map(([label, value]) => <div key={label}><dt className="text-xs text-surface-500 dark:text-surface-400">{label}</dt><dd className="font-semibold text-surface-900 dark:text-white">{value}</dd></div>)}
        </dl>
      )}
      {localizedMissing.length > 0 && <p className="mt-3 text-xs text-amber-800 dark:text-amber-200"><strong>{copy.stillNeeded}</strong> {localizedMissing.join(', ')}.</p>}
      <p className="mt-2 text-xs text-surface-600 dark:text-surface-300">{copy.privacy}</p>
      <button type="button" onClick={() => onStart(draft)} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700">
        {copy.open} <FiChevronRight aria-hidden="true" />
      </button>
      {draft.state === 'reviewing' && !localizedMissing.length && canApprove && (
        <button type="button" disabled={isSubmitting} onClick={() => onApprove(draft)} className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-500 bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
          {isSubmitting ? t('assistant.submittingReport') : t('assistant.approveSubmit')}
        </button>
      )}
      {Number.isFinite(draft.confidence) && (
        <div className="mt-3" aria-label={`${draft.confidence}% ${copy.complete}`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-950"><div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, draft.confidence))}%` }} /></div>
        </div>
      )}
      {draft.changedFields?.length > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-200">
          <strong>{copy.updated}:</strong>
          <ul className="mt-1 space-y-1">
            {draft.changedFields.map((change) => <li key={`${change.turn}-${change.field}`}>{change.field}: {String(change.before || '—')} → {String(change.after || '—')}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
};

const PersonalSummary = ({ summary, t }) => {
  if (!summary) return null;
  const metrics = [
    [t('assistant.lostReports'), summary.lostReports],
    [t('assistant.foundReports'), summary.foundReports],
    [t('assistant.pendingClaims'), summary.pendingClaims],
    [t('assistant.suggestedMatches'), summary.suggestedMatches],
    [t('assistant.unreadAlerts'), summary.unreadNotifications],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={t('assistant.accountActivity')}>
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-surface-200 bg-white p-3 dark:border-surface-600 dark:bg-surface-800">
          <div className="text-xl font-bold text-surface-900 dark:text-white">{value ?? 0}</div>
          <div className="text-xs text-surface-500 dark:text-surface-400">{label}</div>
        </div>
      ))}
    </div>
  );
};

const AIChatbot = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const user = useSelector((state) => state.auth.user);
  const principalId = user?._id || 'guest';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => [initialMessage(t)]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [quickReplies, setQuickReplies] = useState(DEFAULT_QUICK_REPLIES);
  const [voiceLanguage, setVoiceLanguage] = useState('auto');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [sessionVersion, setSessionVersion] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [panel, setPanel] = useState('chat');
  const [mobileViewport, setMobileViewport] = useState(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isRequestingHandoff, setIsRequestingHandoff] = useState(false);
  const [speakingMessage, setSpeakingMessage] = useState(-1);
  const messageStreamRef = useRef(null);
  const dialogRef = useRef(null);
  const panelTitleRef = useRef(null);
  const floatingButtonRef = useRef(null);
  const inputRef = useRef(null);
  const activeConversationRef = useRef(conversationId);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const voiceConsentRef = useRef(false);
  const reportSubmissionInFlightRef = useRef(false);
  const suppressHistoryWriteRef = useRef(false);

  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  useEffect(() => {
    activeConversationRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
    const updateVoices = () => setAvailableVoices(window.speechSynthesis.getVoices?.() || []);
    updateVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', updateVoices);
  }, []);

  const isBusy = isLoading || isSubmittingReport || isRequestingHandoff;
  const closeAssistant = () => {
    setPanel('chat');
    setIsOpen(false);
  };
  const returnToChat = () => {
    setPanel('chat');
    dialogRef.current?.focus({ preventScroll: true });
  };
  const translateQuickReply = (reply) => ({
    'I lost something': t('assistant.quickLost'),
    'I found something': t('assistant.quickFound'),
    'My reports': t('assistant.quickReports'),
    'Refine search': t('assistant.refineSearch'),
  }[reply] || reply);

  useEffect(() => {
    setMessages((previous) => previous.some((message) => message.role === 'user') ? previous : [initialMessage(t)]);
  }, [t]);

  useEffect(() => {
    setHistoryReady(false);
    suppressHistoryWriteRef.current = true;
    const conversations = loadAssistantConversations({ principalId });
    setConversationHistory(conversations);
    if (conversations[0]) {
      suppressHistoryWriteRef.current = true;
      setConversationId(conversations[0].id);
      setSessionVersion(conversations[0].sessionVersion || 0);
      setMessages(conversations[0].messages.length ? conversations[0].messages : [initialMessage(t)]);
    } else {
      setConversationId(createAssistantConversation().id);
      setSessionVersion(0);
      setMessages([initialMessage(t)]);
    }
    setQuickReplies(DEFAULT_QUICK_REPLIES);
    setInput('');
    setPanel('chat');
    setHistoryReady(true);
  }, [principalId, t]);

  useEffect(() => {
    if (!historyReady || !conversationId) return;
    if (suppressHistoryWriteRef.current) {
      suppressHistoryWriteRef.current = false;
      return;
    }
    if (!messages.some((message) => message.role === 'user')) return;
    setConversationHistory((previous) => {
      const existing = previous.find((conversation) => conversation.id === conversationId);
      const current = createAssistantConversation({
        id: conversationId,
        messages,
        createdAt: existing?.createdAt,
        sessionVersion,
      });
      return saveAssistantConversations(
        [current, ...previous.filter((conversation) => conversation.id !== conversationId)],
        { principalId },
      );
    });
  }, [conversationId, historyReady, messages, principalId, sessionVersion]);

  const beginNewConversation = () => {
    suppressHistoryWriteRef.current = true;
    setConversationId(createAssistantConversation().id);
    setSessionVersion(0);
    setMessages([initialMessage(t)]);
    setQuickReplies(DEFAULT_QUICK_REPLIES);
    setInput('');
    setPanel('chat');
    focusConversation(dialogRef.current, inputRef.current);
  };

  const openConversation = (conversation) => {
    suppressHistoryWriteRef.current = true;
    setConversationId(conversation.id);
    setSessionVersion(conversation.sessionVersion || 0);
    setMessages(conversation.messages.length ? conversation.messages : [initialMessage(t)]);
    setQuickReplies([]);
    setPanel('chat');
    focusConversation(dialogRef.current, inputRef.current);
  };

  const deleteConversation = (conversationIdToDelete) => {
    const remaining = removeAssistantConversation(conversationIdToDelete, { principalId });
    setConversationHistory(remaining);
    if (conversationIdToDelete === conversationId) beginNewConversation();
  };

  const clearAllConversationHistory = () => {
    clearAssistantConversations({ principalId });
    setConversationHistory([]);
    beginNewConversation();
  };

  const startReportDraft = (draft) => {
    try {
      saveAssistantReportDraft(draft, { principalId });
    } catch {
      toast.error(t('assistant.storageUnavailable'));
    }
    closeAssistant();
    navigate(draft.reportType === 'found' ? '/dashboard/report-found' : '/dashboard/report-lost');
  };

  const approveAndSubmitReport = async (draft) => {
    if (reportSubmissionInFlightRef.current) return;
    if (!user?._id) {
      saveAssistantReportDraft(draft, { principalId });
      closeAssistant();
      navigate('/login', { state: { from: draft.reportType === 'found' ? '/dashboard/report-found' : '/dashboard/report-lost' } });
      return;
    }
    if (!window.confirm(t('assistant.submitConfirmation'))) return;
    reportSubmissionInFlightRef.current = true;
    setIsSubmittingReport(true);
    try {
      const confirmationResponse = await api.post('/ai/report/confirm', {
        sessionId: conversationId,
        sessionVersion: draft.version,
      });
      const confirmation = confirmationResponse.data?.data;
      setSessionVersion(confirmation.sessionVersion);
      const submissionResponse = await api.post('/ai/report/submit', {
        sessionId: conversationId,
        sessionVersion: confirmation.sessionVersion,
        confirmationToken: confirmation.confirmationToken,
      });
      const receipt = submissionResponse.data?.data;
      setSessionVersion(receipt.sessionVersion || confirmation.sessionVersion + 1);
      setMessages((previous) => [
        ...previous.map((entry) => entry.reportDraft ? { ...entry, reportDraft: null } : entry),
        {
          role: 'ai',
          content: t('assistant.reportSubmitted', { item: receipt.itemName }),
          timestamp: timestamp(),
          actions: [{ type: 'view_report', label: t('assistant.viewSubmittedReport'), url: receipt.url }],
          items: [],
        },
      ]);
      setQuickReplies([]);
      toast.success(t('assistant.reportSubmittedToast'));
    } catch (error) {
      toast.error(error?.response?.status === 409 ? t('assistant.reportDraftChanged') : t('assistant.reportSubmitFailed'));
    } finally {
      reportSubmissionInFlightRef.current = false;
      setIsSubmittingReport(false);
    }
  };

  const latestDraftIndex = messages.reduce((latest, message, index) => message.reportDraft ? index : latest, -1);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('lf:assistant-state', { detail: { isOpen } }));
    return () => window.dispatchEvent(new CustomEvent('lf:assistant-state', { detail: { isOpen: false } }));
  }, [isOpen]);

  useEffect(() => {
    const stream = messageStreamRef.current;
    if (stream) stream.scrollTop = messages.length > 1 ? stream.scrollHeight : 0;
  }, [isOpen, panel, messages, quickReplies, isLoading, mobileViewport?.height]);

  useEffect(() => {
    if (isOpen && panel !== 'chat') panelTitleRef.current?.focus({ preventScroll: true });
  }, [isOpen, panel]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const launcher = floatingButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia(COMPACT_ASSISTANT).matches) document.body.style.overflow = 'hidden';
    focusConversation(dialogRef.current, inputRef.current);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAssistant();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      recognitionRef.current?.stop?.();
      launcher?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMobileViewport(null);
      return undefined;
    }
    const viewport = window.visualViewport;
    const syncViewport = () => {
      if (!window.matchMedia(COMPACT_ASSISTANT).matches) {
        setMobileViewport(null);
        return;
      }
      setMobileViewport({
        height: Math.round(viewport?.height || window.innerHeight),
        top: Math.round(viewport?.offsetTop || 0),
      });
    };
    const handleResize = () => {
      syncViewport();
      fitComposer(inputRef.current);
    };
    const handleFontsLoaded = () => fitComposer(inputRef.current);
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', handleResize);
    document.fonts?.addEventListener('loadingdone', handleFontsLoaded);
    return () => {
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', handleResize);
      document.fonts?.removeEventListener('loadingdone', handleFontsLoaded);
    };
  }, [isOpen]);

  const requestAssistant = async (message, { page = 1, displayUser = true } = {}) => {
    const trimmed = String(message || '').trim();
    if (!trimmed || !historyReady || !conversationId || isBusy) return;
    const history = messages.slice(-10).map(({ role, content }) => ({ role: role === 'ai' ? 'assistant' : role, content }));
    const conversationStyle = [...messages].reverse().find((entry) => entry.responseStyle)?.responseStyle;
    if (displayUser) {
      setMessages((previous) => [...previous, { role: 'user', content: trimmed, timestamp: timestamp() }]);
      setInput('');
    }
    setQuickReplies([]);
    setIsLoading(true);

    try {
      const response = await api.post('/ai/chat', {
        message: trimmed,
        history,
        locale: language,
        conversationStyle,
        sessionId: conversationId,
        sessionVersion,
        page,
        pageSize: 6,
      });
      if (activeConversationRef.current !== conversationId) return;
      const data = response.data?.data || {};
      if (Number.isFinite(data.sessionState?.version)) setSessionVersion(data.sessionState.version);
      setMessages((previous) => [
        ...previous.map((entry) => entry.reportDraft ? { ...entry, reportDraft: null } : entry),
        {
          role: 'ai',
          content: data.text || t('assistant.noResponse'),
          responseStyle: data.responseStyle,
          timestamp: timestamp(),
          items: data.items || [],
          actions: data.actions || [],
          personalSummary: data.personalSummary,
          reportDraft: data.reportDraft,
          meta: data.meta,
          knowledge: data.knowledge,
          query: data.query,
          page: data.page,
          total: data.total,
          hasMore: data.hasMore,
        },
      ]);
      setQuickReplies(data.quickReplies || []);
    } catch (error) {
      if (activeConversationRef.current !== conversationId) return;
      toast.error(t('assistant.connectionFailed'));
      setMessages((previous) => [...previous, {
        role: 'ai',
        content: t('assistant.unavailable'),
        timestamp: timestamp(),
        items: [],
        actions: [
          { type: 'search', label: t('assistant.openSearch'), url: '/lost-items' },
          { type: 'report_lost', label: t('assistant.reportLost'), url: '/dashboard/report-lost' },
        ],
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useLayoutEffect(() => {
    fitComposer(inputRef.current);
  }, [isOpen, panel, input, t]);

  const handleSubmit = (event) => {
    event.preventDefault();
    requestAssistant(input);
  };

  const toggleListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(t('assistant.voiceUnsupported'));
      return;
    }
    if (!voiceConsentRef.current) {
      const consented = window.confirm(t('assistant.voiceConsent'));
      if (!consented) return;
      voiceConsentRef.current = true;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLanguage === 'auto'
      ? speechStyleLocale(language)
      : voiceLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setInput((previous) => `${previous} ${transcript}`.trim());
      toast.success(t('assistant.voiceReview'));
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast.error(t('assistant.voiceStopped'));
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const speakMessage = (message, index) => {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      toast.error(t('assistant.ttsUnsupported'));
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingMessage === index) {
      setSpeakingMessage(-1);
      return;
    }
    const spokenText = String(message.content || '').replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1').replace(/[*#_>]/gu, ' ').replaceAll('\u0060', ' ').replace(/\s+/gu, ' ').trim().slice(0, 3000);
    if (!spokenText) return;
    const speech = resolveSpeechSettings({
      responseStyle: message.responseStyle,
      selectedVoice: voiceLanguage,
      interfaceLanguage: language,
    });
    const utterance = new window.SpeechSynthesisUtterance(spokenText);
    utterance.lang = speech.locale;
    const selectedVoice = selectSpeechVoice(availableVoices, speech.candidates);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingMessage(-1);
    utterance.onerror = () => setSpeakingMessage(-1);
    utteranceRef.current = utterance;
    setSpeakingMessage(index);
    window.speechSynthesis.speak(utterance);
  };

  const requestHumanHandoff = async () => {
    if (!user) {
      closeAssistant();
      navigate('/login');
      return;
    }
    if (!conversationId || isRequestingHandoff) return;
    if (!window.confirm(t('assistant.handoffConsent'))) return;
    setIsRequestingHandoff(true);
    try {
      const response = await api.post('/ai/handoff', {
        sessionId: conversationId,
        consent: true,
        reason: input.trim() || t('assistant.handoffReason'),
      });
      const { ticketId, stateVersion } = response.data?.data || {};
      if (!ticketId) throw new Error('Missing helpdesk ticket ID');
      if (activeConversationRef.current === conversationId && Number.isInteger(stateVersion)) {
        setSessionVersion((current) => Math.max(current, stateVersion));
      }
      toast.success(t('assistant.handoffQueued', { id: ticketId }));
    } catch {
      toast.error(t('assistant.handoffFailed'));
    } finally {
      setIsRequestingHandoff(false);
    }
  };

  const isInitialOnly = messages.length === 1 && messages[0].role === 'ai';

  return (
    <>
      <button
        type="button"
        ref={floatingButtonRef}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] right-4 z-50 flex min-h-12 items-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white shadow-lg hover:bg-primary-700 focus-visible:ring-4 focus-visible:ring-primary-300 sm:bottom-6 sm:right-6 ${isOpen ? 'pointer-events-none opacity-0' : ''}`}
        tabIndex={isOpen ? -1 : 0}
        aria-label={t('assistant.openAria')}
        aria-haspopup="dialog"
      >
        <FiMessageSquare className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">{t('assistant.askButton')}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[79] bg-surface-950/30" aria-hidden="true" onMouseDown={closeAssistant} />
      )}

      {isOpen && (
      <section
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="smart-lf-assistant-title"
        className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-white shadow-2xl outline-none dark:bg-surface-900 sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[min(32rem,calc(100vw-2rem))] sm:rounded-2xl sm:border sm:border-surface-200/80 sm:dark:border-surface-700/80"
        style={mobileViewport ? { height: `${mobileViewport.height}px`, top: `${mobileViewport.top}px`, bottom: 'auto' } : undefined}
      >
        <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-surface-200 px-3 pt-[env(safe-area-inset-top,0px)] dark:border-surface-800">
          {panel === 'chat' ? (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
              <FaRobot className="h-4 w-4" aria-hidden="true" />
            </div>
          ) : (
            <button type="button" onClick={returnToChat} className={CHAT_ICON_BUTTON} aria-label={t('assistant.backToChat')}>
              <FiArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <h2 id="smart-lf-assistant-title" className="min-w-0 flex-1 text-sm font-bold leading-tight text-surface-900 dark:text-white sm:text-base">{t('assistant.title')}</h2>
          {panel === 'chat' && (
            <button type="button" onClick={() => setPanel('options')} className={CHAT_ICON_BUTTON} aria-label={t('assistant.options')} title={t('assistant.options')}>
              <FiMoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={closeAssistant} className={CHAT_ICON_BUTTON} aria-label={t('assistant.closeAria')}>
            <FiX className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {panel === 'options' && (
          <section className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-labelledby="assistant-options-title">
            <h3 id="assistant-options-title" ref={panelTitleRef} tabIndex={-1} className="font-semibold text-surface-900 outline-none dark:text-white">{t('assistant.options')}</h3>
            <div className="space-y-1">
              <button type="button" onClick={beginNewConversation} disabled={isBusy} className={CHAT_OPTION}><FiPlus aria-hidden="true" />{t('assistant.newConversation')}</button>
              <button type="button" onClick={() => setPanel('history')} className={CHAT_OPTION}><FiClock aria-hidden="true" />{t('assistant.historyTitle')}</button>
              <button type="button" disabled={!historyReady || isBusy} onClick={() => {
                returnToChat();
                requestAssistant(t('assistant.starterLibraryPrompt'));
              }} className={CHAT_OPTION}><FiSearch aria-hidden="true" />{t('assistant.starterLibraryTitle')}</button>
              <button type="button" disabled={!historyReady || isBusy} onClick={() => {
                returnToChat();
                requestAssistant(t('assistant.starterActivityPrompt'));
              }} className={CHAT_OPTION}><FiUsers aria-hidden="true" />{t('assistant.starterActivityTitle')}</button>
            </div>
            <div className="border-t border-surface-200 pt-4 dark:border-surface-700">
              <label htmlFor="assistant-voice-language" className="text-sm font-medium">{t('assistant.voiceLanguage')}</label>
              <select id="assistant-voice-language" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-surface-300 bg-white px-3 text-base dark:border-surface-600 dark:bg-surface-800">
                {voiceOptions(t).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </section>
        )}

        {panel === 'history' && (
          <section className="min-h-0 flex-1 overflow-y-auto p-4" aria-labelledby="assistant-history-title">
            <h3 id="assistant-history-title" ref={panelTitleRef} tabIndex={-1} className="font-semibold text-surface-900 outline-none dark:text-white">{t('assistant.historyTitle')}</h3>
            <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">{t('assistant.historyDesc')}</p>
            {conversationHistory.length ? (
              <ul className="mt-3 space-y-2">
                {conversationHistory.map((conversation) => (
                  <li key={conversation.id} className="flex items-stretch gap-2 rounded-xl border border-surface-200 p-1.5 dark:border-surface-700">
                    <button type="button" disabled={isBusy} onClick={() => openConversation(conversation)} className="min-h-11 min-w-0 flex-1 rounded-lg px-3 text-left hover:bg-surface-50 disabled:opacity-50 dark:hover:bg-surface-800" aria-current={conversation.id === conversationId ? 'true' : undefined}>
                      <span className="block truncate text-sm font-semibold text-surface-900 dark:text-white">{conversation.title}</span>
                      <span className="block text-xs text-surface-500 dark:text-surface-400">{new Date(conversation.updatedAt).toLocaleString()} · {t('assistant.messagesCount', { count: conversation.messages.length })}</span>
                    </button>
                    <button type="button" disabled={isBusy} onClick={() => deleteConversation(conversation.id)} className={CHAT_ICON_BUTTON + ' hover:text-rose-600 disabled:opacity-50'} aria-label={t('assistant.deleteConversation', { title: conversation.title })}><FiTrash2 aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-surface-500 dark:text-surface-400">{t('assistant.noHistory')}</p>
            )}
            {conversationHistory.length > 0 && <button type="button" disabled={isBusy} onClick={clearAllConversationHistory} className="mt-4 min-h-11 w-full rounded-xl border border-rose-200 px-4 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/30">{t('assistant.clearHistory')}</button>}
          </section>
        )}

        {panel === 'chat' && <>
        {/* Message Stream */}
        <div ref={messageStreamRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite" aria-relevant="additions">
          {messages.map((message, index) => (
            <div key={`${message.timestamp}-${index}`} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="min-w-0 max-w-[92%]">
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 [overflow-wrap:anywhere] ${
                  message.role === 'user'
                    ? 'rounded-br-sm bg-primary-600 text-white'
                    : 'rounded-bl-sm bg-surface-100 text-surface-900 dark:bg-surface-800 dark:text-surface-100'
                }`}>
                  {message.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown components={{
                        a: ({ href, children }) => isSafeInternalPath(href) ? (
                          <Link to={toSafeInternalPath(href)} onClick={closeAssistant} className="font-semibold text-primary-600 underline dark:text-primary-400 hover:opacity-80">{children}</Link>
                        ) : <span>{children}</span>,
                      }}>{message.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              {message.personalSummary && <div className="mt-3 w-full"><PersonalSummary summary={message.personalSummary} t={t} /></div>}
              {message.reportDraft && <ReportDraftCard draft={message.reportDraft} onStart={startReportDraft} onApprove={approveAndSubmitReport} isSubmitting={isSubmittingReport} canApprove={index === latestDraftIndex && message.reportDraft.version === sessionVersion} responseStyle={message.responseStyle} t={t} />}
              {message.knowledge?.citations?.length > 0 && (
                <div className="mt-2 flex w-full flex-wrap gap-2" aria-label={t('assistant.knowledgeSources')}>
                  {message.knowledge.citations.filter((citation) => isSafeCitationUrl(citation.url)).map((citation) => isSafeInternalPath(citation.url) ? (
                    <Link key={citation.url} to={citation.url} className="rounded-full border border-cyan-300 px-3 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-800 dark:text-cyan-300">{citation.label}</Link>
                  ) : (
                    <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-300 px-3 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-800 dark:text-cyan-300">{citation.label}</a>
                  ))}
                </div>
              )}

              {message.items?.length > 0 && (
                <div className="mt-3 w-full space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">{t('assistant.showingResults', { shown: message.items.length, total: message.total })}</p>
                  {message.items.map((item) => <AssistantResultCard key={`${item.itemType}-${item._id}`} item={item} closeAssistant={closeAssistant} t={t} />)}
                  <p className="text-xs text-surface-500 dark:text-surface-400">{t('assistant.ownershipNote')}</p>
                  {message.hasMore && message.query?.message && (
                    <button
                      type="button"
                      onClick={() => requestAssistant(message.query.message, { page: (message.page || 1) + 1, displayUser: false })}
                      disabled={isBusy}
                      className="min-h-10 w-full rounded-xl border border-primary-300 bg-primary-50/50 px-4 text-xs font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-50 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-300 transition"
                    >
                      {t('assistant.showMore')}
                    </button>
                  )}
                </div>
              )}

              {message.actions?.length > 0 && (
                <div className="mt-3 flex w-full flex-wrap gap-2">
                  {message.actions.map((action) => {
                    const safeUrl = toSafeInternalPath(action.url, '');
                    return safeUrl ? (
                      <Link key={`${action.type}-${action.url}`} to={safeUrl} onClick={closeAssistant} className="inline-flex min-h-9 items-center rounded-xl border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-800 shadow-sm hover:border-primary-400 hover:text-primary-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100 transition">
                        {action.label}
                      </Link>
                    ) : null;
                  })}
                </div>
              )}

              {message.meta?.notice && (
                <div className="mt-3 flex w-full gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                  <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div><strong>{message.meta.notice}</strong><div className="mt-0.5 font-normal text-amber-800/90 dark:text-amber-300/80">{t('assistant.source', { source: message.meta.source })}</div></div>
                </div>
              )}
              {!isInitialOnly && message.role === 'ai' && index > 0 && (
                <button type="button" onClick={() => speakMessage(message, index)} className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800" aria-label={speakingMessage === index ? t('assistant.stopSpeaking') : t('assistant.speak')}>
                  {speakingMessage === index ? <FiSquare aria-hidden="true" /> : <FiVolume2 aria-hidden="true" />}
                  {speakingMessage === index ? t('assistant.stop') : t('assistant.listen')}
                </button>
              )}
            </div>
          ))}

          {isInitialOnly && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!historyReady || isBusy} onClick={() => requestAssistant(t('assistant.starterLostPrompt'))} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-surface-300 px-4 text-sm font-medium hover:bg-surface-100 disabled:opacity-50 dark:border-surface-700 dark:hover:bg-surface-800">
                <FiSearch aria-hidden="true" />{t('assistant.starterLostTitle')}
              </button>
              <button type="button" disabled={!historyReady || isBusy} onClick={() => requestAssistant(t('assistant.starterFoundPrompt'))} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-surface-300 px-4 text-sm font-medium hover:bg-surface-100 disabled:opacity-50 dark:border-surface-700 dark:hover:bg-surface-800">
                <FiPackage aria-hidden="true" />{t('assistant.starterFoundTitle')}
              </button>
            </div>
          )}


          {isLoading && (
            <div role="status" className="flex items-center gap-3 rounded-2xl bg-surface-100/80 p-3.5 text-sm text-surface-600 dark:bg-surface-800/80 dark:text-surface-300 border border-surface-200/50 dark:border-surface-700/50">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" aria-hidden="true" />
              <span className="text-xs font-medium">{t('assistant.searching')}</span>
            </div>
          )}

          {!isLoading && !isInitialOnly && quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1" aria-label={t('assistant.suggestedQuestions')}>
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  disabled={isBusy}
                  onClick={() => reply === 'Refine search' ? inputRef.current?.focus() : requestAssistant(translateQuickReply(reply))}
                  className="min-h-11 rounded-full border border-surface-300 px-3.5 text-xs font-medium hover:bg-surface-100 disabled:opacity-50 dark:border-surface-700 dark:hover:bg-surface-800"
                >
                  {translateQuickReply(reply)}
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(100%-4rem)] shrink-0 overflow-y-auto overscroll-contain border-t border-surface-200 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] dark:border-surface-800">
          <div className="flex items-end gap-1.5 rounded-xl border border-surface-300 bg-surface-50 p-1 focus-within:border-primary-500 dark:border-surface-700 dark:bg-surface-800">
            <label htmlFor="assistant-message" className="sr-only">{t('assistant.inputLabel')}</label>
            <textarea
              ref={inputRef}
              id="assistant-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  requestAssistant(input);
                }
              }}
              rows={1}
              maxLength={500}
              enterKeyHint="send"
              placeholder={t('assistant.placeholder')}
              className="block min-h-11 min-w-0 flex-1 max-h-28 resize-none overflow-y-auto border-0 bg-transparent px-2.5 py-2 text-base leading-relaxed text-surface-900 outline-none placeholder:text-surface-500 sm:max-h-40 dark:text-white dark:placeholder:text-surface-400"
            />
            <button type="button" onClick={toggleListening} className={CHAT_ICON_BUTTON + (isListening ? ' bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : '')}
              aria-label={isListening ? t('assistant.stopVoice') : t('assistant.startVoice')} aria-pressed={isListening}>
              <FiMic className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="submit" disabled={!input.trim() || !historyReady || isBusy} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-40" aria-label={t('assistant.send')}>
              <FiSend className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={requestHumanHandoff} disabled={!historyReady || isBusy} aria-busy={isRequestingHandoff} className="mx-auto flex min-h-11 items-center gap-2 px-3 text-xs font-medium text-surface-600 hover:underline disabled:opacity-50 dark:text-surface-300">
            <FiUsers aria-hidden="true" />{t('assistant.handoff')}
          </button>
        </form>
        </>}
      </section>
      )}
    </>
  );
};

export default AIChatbot;
