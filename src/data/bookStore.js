import { publicUrl } from "../lib/paths.js";

const DRAFT_KEY = "otara.teacher.draft";
const PUBLISHED_KEY = "otara.teacher.published";
const BOOKS_KEY = "otara.books";
const AUTH_KEY = "otara.auth";

export const passwords = {
  teacher: "teacher123",
  student: "student123",
};

export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {
    return null;
  }
}

export function setAuth(role) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ role, at: Date.now() }));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function saveDraft(book) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(book));
  upsertBook({ ...book, status: "draft" });
}

export function loadDraft() {
  return normalizeBook(loadStored(DRAFT_KEY));
}

export function publishBook(book) {
  const published = { ...book, status: "published", settings: { ...book.settings, publishedAt: new Date().toISOString() } };
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
  upsertBook(published);
  return published;
}

export function loadPublished() {
  return normalizeBook(loadStored(PUBLISHED_KEY));
}

export function loadBooks(status) {
  const books = loadStored(BOOKS_KEY) || [];
  return books.map(normalizeBook).filter(Boolean).filter((book) => !status || book.status === status);
}

export function mergeDefaultMedia(defaultBook, storedBook) {
  if (!defaultBook?.pages || !storedBook?.pages) return storedBook || defaultBook;
  const defaultsByPage = new Map(defaultBook.pages.map((page) => [page.pageNumber, page]));
  return normalizeBook({
    ...storedBook,
    bgm: storedBook.bgm?.length ? storedBook.bgm : defaultBook.bgm,
    pages: storedBook.pages.map((page) => {
      const defaultPage = defaultsByPage.get(page.pageNumber);
      if (!defaultPage) return page;
      return {
        ...page,
        image: page.image || defaultPage.image,
        audio: page.audio || defaultPage.audio,
      };
    }),
  });
}

export function upsertBook(book) {
  const books = loadStored(BOOKS_KEY) || [];
  const normalized = normalizeBook(book);
  const next = [normalized, ...books.filter((item) => item.id !== normalized.id)];
  localStorage.setItem(BOOKS_KEY, JSON.stringify(next));
  return normalized;
}

function loadStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export async function loadDefaultBook() {
  const index = await fetch(publicUrl("api/index.json")).then((r) => r.json());
  const pages = await Promise.all(
    index.map(async (url, i) => {
      const raw = await fetch(publicUrl(url)).then((r) => r.json());
      const content = typeof raw.content === "string"
        ? { en: raw.content, mi: raw.content }
        : { en: raw.content.en || raw.content.mi || "", mi: raw.content.mi || raw.content.en || "" };
      const title = extractTitle(content.en || content.mi) || `Page ${i + 1}`;

      return {
        id: `page-${raw.page_number || i + 1}`,
        pageNumber: raw.page_number || i + 1,
        title,
        content: {
          en: cleanupStoryText(content.en, title),
          mi: cleanupStoryText(content.mi, title),
        },
        image: raw.image || "",
        audio: "",
        nextPage: raw.next_page,
        previousPage: raw.previous_page,
        ai: {
          cultureTerms: [],
          questions: [defaultQuestion()],
        },
        sprite: {
          kiriEnabled: true,
          mokoEnabled: true,
          mokoEmotion: "happy",
          pageReaction: "",
          correctReaction: "",
          incorrectReaction: "",
          reactionPreset: "encouraging",
          reactionMode: "ai",
        },
        puzzle: {
          enabled: false,
          rows: 3,
          columns: 3,
        },
      };
    }),
  );

  return {
    id: "te-tahi-o-te-ra",
    title: "Te Tahi-o-Te-Rā",
    subtitle: "The Guardian of Otara",
    author: "Te Kahautu Maxwell",
    pages,
    bgm: ["bgm/08 Spikeroog.mp3"],
    settings: {
      language: "en",
      publishedAt: null,
      aiProvider: "offline",
      aiModel: "llama-3.1-8b-instant",
      aiToken: "",
      aiEndpoint: "https://api.groq.com/openai/v1/chat/completions",
      kiriSprite: "owl",
      mokoSprite: "taniwha",
    },
  };
}

function normalizeBook(book) {
  if (!book?.pages) return book;
  return {
    ...book,
    bgm: book.bgm?.length ? book.bgm : ["bgm/08 Spikeroog.mp3"],
    pages: book.pages.map((page, index) => {
      const title = stripHtml(page.title || extractTitle(page.content?.en || page.content?.mi) || `Page ${index + 1}`);
      return {
        ...page,
        pageNumber: index + 1,
        title,
        content: {
          en: cleanupStoryText(page.content?.en || "", title),
          mi: cleanupStoryText(page.content?.mi || page.content?.en || "", title),
        },
        ai: {
          ...page.ai,
          cultureTerms: page.ai?.cultureTerms || [],
          questions: normalizeQuestions(page.ai),
        },
        sprite: {
          kiriEnabled: page.sprite?.kiriEnabled !== false,
          mokoEnabled: page.sprite?.mokoEnabled !== false,
          mokoEmotion: page.sprite?.mokoEmotion || "happy",
          pageReaction: page.sprite?.pageReaction || page.sprite?.mokoReaction || "",
          correctReaction: page.sprite?.correctReaction || "",
          incorrectReaction: page.sprite?.incorrectReaction || "",
          reactionPreset: page.sprite?.reactionPreset || "encouraging",
          reactionMode: page.sprite?.reactionMode || "ai",
        },
        puzzle: {
          enabled: Boolean(page.puzzle?.enabled),
          rows: Number(page.puzzle?.rows || 3),
          columns: Number(page.puzzle?.columns || 3),
        },
      };
    }),
  };
}

export function defaultQuestion() {
  return {
    id: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    prompt: "",
    answers: [
      { id: "a", text: "", reaction: "" },
      { id: "b", text: "", reaction: "" },
      { id: "c", text: "", reaction: "" },
    ],
    correctAnswerId: "a",
  };
}

function normalizeQuestions(ai = {}) {
  if (Array.isArray(ai.questions) && ai.questions.length) {
    return ai.questions.map((question) => ({
      ...defaultQuestion(),
      ...question,
      answers: (question.answers?.length ? question.answers : defaultQuestion().answers).map((answer, index) => ({
        id: answer.id || String.fromCharCode(97 + index),
        text: answer.text || "",
        reaction: answer.reaction || "",
      })),
      correctAnswerId: question.correctAnswerId || "a",
    }));
  }

  return [{
    ...defaultQuestion(),
    prompt: ai.question || "",
    answers: (ai.answers?.length ? ai.answers : defaultQuestion().answers).map((answer, index) => ({
      id: answer.id || String.fromCharCode(97 + index),
      text: answer.text || "",
      reaction: answer.reaction || "",
    })),
    correctAnswerId: ai.correctAnswerId || "a",
  }];
}

export async function loadOfflineAi(pageNumber) {
  const names = ["cultureExtractor", "questionGenerator", "answerGenerator", "commentator", "reactor", "answerReactor"];
  const result = {};

  await Promise.all(names.map(async (name) => {
    try {
      result[name] = await fetch(publicUrl(`api/offline/${name}.json`)).then((r) => r.json());
    } catch {
      result[name] = {};
    }
  }));

  const pageKey = `page_${pageNumber}`;
  return {
    terms: result.cultureExtractor?.[pageKey] || [],
    question: result.questionGenerator?.[pageKey] || "What did you notice on this page?",
    answers: normalizeAnswers(result.answerGenerator?.[pageKey]),
    feedback: result.commentator?.[pageKey] || "Good thinking. Every thoughtful answer helps the story feel alive.",
    reaction: normalizeLine(result.reactor?.[pageKey], "This page feels important."),
    answerReaction: normalizeLine(result.answerReactor?.[pageKey], "Nice choice. Keep reading."),
  };
}

function normalizeAnswers(value) {
  if (value?.answers) {
    return normalizeAnswers(value.answers);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 3).map((text, index) => ({ id: String.fromCharCode(97 + index), text: String(text) }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).slice(0, 3).map(([id, text]) => ({ id, text: String(text) }));
  }

  return [
    { id: "a", text: "It protects the land and its people." },
    { id: "b", text: "It shows how stories can guide us." },
    { id: "c", text: "It reminds readers to listen carefully." },
  ];
}

function normalizeLine(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value.text === "string") return value.text;
  return fallback;
}

function extractTitle(html) {
  const match = String(html).match(/<h1[^>]*>(.*?)<\/h1>|<h2[^>]*>(.*?)<\/h2>|<h3[^>]*>(.*?)<\/h3>/i);
  return match ? stripHtml(match[1] || match[2] || match[3]).slice(0, 60) : "";
}

export function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanupStoryText(value, title) {
  const text = stripHtml(value);
  return text.startsWith(title) ? text.slice(title.length).trim() : text;
}
