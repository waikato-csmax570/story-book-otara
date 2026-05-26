import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Eye,
  LogOut,
  Music,
  Plus,
  Save,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  clearAuth,
  getAuth,
  loadDefaultBook,
  loadDraft,
  loadOfflineAi,
  loadPublished,
  loadBooks,
  mergeDefaultMedia,
  passwords,
  publishBook,
  saveDraft,
  setAuth,
  defaultQuestion,
  upsertBook,
} from "./data/bookStore.js";
import { publicUrl } from "./lib/paths.js";

const tabs = ["Content", "AI & Questions", "Sprite Behavior"];
const reactionPresets = [
  "warm",
  "curious",
  "culture",
];
const greetingPresetText = {
  warm: "Kia ora! Take your time and enjoy this page.",
  curious: "What do you notice first on this page?",
  culture: "Look for the people, places, and values in this part of the story.",
};
const answerReactionPresets = {
  warm: {
    correct: "Great answer. You found the heart of the page.",
    incorrect: "Good try. Look back at the story and have another go.",
  },
  curious: {
    correct: "Nice thinking. What clue helped you choose that?",
    incorrect: "Keep exploring. The answer is hiding in the details.",
  },
  culture: {
    correct: "Beautiful. That connects well with the story's values.",
    incorrect: "Good effort. Think about what the page teaches about care and belonging.",
  },
};
const dictionary = {
  guardian: "kaitiaki",
  children: "tamariki",
  book: "pukapuka",
  story: "purakau",
  family: "whanau",
  river: "awa",
  forest: "ngahere",
  people: "tangata",
  land: "whenua",
};
const fallbackCultureTerms = [
  { term: "kaitiaki", explanation: "Guardian or caretaker." },
  { term: "whenua", explanation: "Land, home, and place of belonging." },
  { term: "mana", explanation: "Spiritual strength, authority, and respect." },
  { term: "whanau", explanation: "Family and the wider circle of people who care for each other." },
  { term: "awa", explanation: "River, often understood as a living ancestor and source of life." },
  { term: "tamariki", explanation: "Children or young people." },
];

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pageKeywords(page) {
  const source = `${page.title || ""} ${page.content?.en || ""}`;
  return Array.from(new Set(source.match(/\b[A-Za-z][A-Za-z'-]{4,}\b/g) || []))
    .filter((word) => !["about", "there", "their", "which", "would", "could", "story", "page"].includes(word.toLowerCase()))
    .slice(0, 6);
}

function buildQuestionCandidates(page) {
  const keywords = pageKeywords(page);
  const topic = keywords[0] || page.title || "this page";
  const secondTopic = keywords[1] || "the story";
  return [
    `What role does ${page.title || topic} play in this part of the story?`,
    `What do you think happens next after ${topic}?`,
    `Why is ${topic} important to the people in the story?`,
    `How does this page show care for ${secondTopic}?`,
    `What feeling does this page create, and what story detail gives you that idea?`,
    `What lesson can readers learn from ${page.title || "this page"}?`,
  ];
}

function answerSetFor(questionText) {
  const text = normalizeText(questionText);
  if (text.includes("happens next")) {
    return {
      correctAnswerId: "b",
      answers: [
        { id: "a", text: "They leave the problem behind", reaction: "Good prediction. Look for the story clue that points forward." },
        { id: "b", text: "The community responds together", reaction: "Great thinking. The story often shows people acting together." },
        { id: "c", text: "The page becomes less important", reaction: "Nice try. The page is setting up something meaningful." },
      ],
    };
  }
  if (text.includes("feeling")) {
    return {
      correctAnswerId: "c",
      answers: [
        { id: "a", text: "It feels silly and unimportant", reaction: "Good try. Look again at the tone of the page." },
        { id: "b", text: "It feels rushed with no detail", reaction: "Not quite. The details are doing important work here." },
        { id: "c", text: "It feels meaningful because of the story details", reaction: "Correct. You connected the feeling to evidence." },
      ],
    };
  }
  if (text.includes("lesson")) {
    return {
      correctAnswerId: "a",
      answers: [
        { id: "a", text: "People should care for each other and the land", reaction: "Correct. That is a strong lesson from the story." },
        { id: "b", text: "People should ignore warnings", reaction: "Try again. The story asks readers to pay attention." },
        { id: "c", text: "Only one person matters", reaction: "Not quite. The wider community matters here." },
      ],
    };
  }
  return {
    correctAnswerId: "a",
    answers: [
      { id: "a", text: "Protect and care for the people and place", reaction: "Correct. That connects well with the page." },
      { id: "b", text: "Ignore what is happening around them", reaction: "Try again. The page points toward care and attention." },
      { id: "c", text: "Leave the story without learning anything", reaction: "Not quite. This page gives readers something to notice." },
    ],
  };
}

function generatedTermsForPage(page, offlineTerms = []) {
  const text = normalizeText(`${page.title || ""} ${page.content?.en || ""} ${page.content?.mi || ""}`);
  const dictionaryTerms = Object.entries(dictionary)
    .filter(([english, maori]) => text.includes(english) || text.includes(normalizeText(maori)))
    .map(([english, maori]) => ({ term: maori, explanation: `${maori} can mean ${english}.` }));
  const combined = [...offlineTerms, ...dictionaryTerms, ...fallbackCultureTerms];
  const seen = new Set();
  return combined.filter((item) => {
    const key = normalizeText(item.term);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function spriteGreeting(sprite = {}, aiLine = "") {
  const mode = sprite.greetingMode || sprite.reactionMode || "ai";
  if (mode === "ai") return aiLine || "This page feels important.";
  if (mode === "custom") return sprite.pageReaction || "Kia ora! Let's read this page together.";
  if (mode === "preset") return sprite.customGreetingPresets?.[sprite.reactionPreset] || greetingPresetText[sprite.reactionPreset || "warm"] || greetingPresetText.warm;
  return "Kia ora! Let's read this page together.";
}

function spriteAnswerReaction(sprite = {}, isCorrect, aiLine = "") {
  const mode = sprite.answerReactionMode || "simple";
  if (mode === "ai") return aiLine || (isCorrect ? "Yaaay! Amazing!" : "Great try. Keep going!");
  if (mode === "custom") return (isCorrect ? sprite.correctReaction : sprite.incorrectReaction) || (isCorrect ? answerReactionPresets.warm.correct : answerReactionPresets.warm.incorrect);
  if (mode === "preset") {
    const preset = answerReactionPresets[sprite.answerReactionPreset || "warm"] || answerReactionPresets.warm;
    return isCorrect ? preset.correct : preset.incorrect;
  }
  return isCorrect ? "Correct. Great thinking!" : "Not quite. Try again with the story clues.";
}

export default function App() {
  const [auth, setAuthState] = useState(getAuth());
  const [book, setBook] = useState(null);
  const [books, setBooks] = useState([]);
  const [route, setRoute] = useState(location.hash.replace("#", "") || "/login");

  useEffect(() => {
    loadDefaultBook().then((defaultBook) => {
      const stored = loadDraft() || loadPublished();
      const initial = stored ? mergeDefaultMedia(defaultBook, stored) : defaultBook;
      upsertBook(initial);
      setBook(initial);
      setBooks(loadBooks());
    });
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(location.hash.replace("#", "") || "/login");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  function navigate(next) {
    location.hash = next;
    setRoute(next);
  }

  function login(role) {
    setAuth(role);
    setAuthState({ role });
    navigate(role === "teacher" ? "/teacher" : "/reader");
  }

  function logout() {
    clearAuth();
    setAuthState(null);
    navigate("/login");
  }

  if (!book) return <div className="loading">Loading book...</div>;

  return (
    <AnimatePresence mode="wait">
      {(!auth || route === "/login") ? (
        <MotionPage key="login"><LoginPage onLogin={login} /></MotionPage>
      ) : route === "/teacher" && auth.role === "teacher" ? (
        <MotionPage key="teacher"><TeacherEditor book={book} books={books} setBooks={setBooks} setBook={setBook} onLogout={logout} onPreview={() => navigate("/reader")} /></MotionPage>
      ) : (
        <MotionPage key="reader"><StudentReader book={book} books={books} setBook={setBook} onLogout={logout} onTeacher={() => navigate("/teacher")} canEdit={auth.role === "teacher"} /></MotionPage>
      )}
    </AnimatePresence>
  );
}

function MotionPage({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function LoginPage({ onLogin }) {
  const [role, setRole] = useState("teacher");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const heroRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".brand-mark", { y: 22, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" });
      gsap.fromTo(".login-hero h1, .login-hero p, .login-panel", { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.85, stagger: 0.08, ease: "power3.out" });
      gsap.to(".login-hero", { backgroundPosition: "52% 48%", duration: 8, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  function submit(event) {
    event.preventDefault();
    if (pass === passwords[role]) onLogin(role);
    else setError("Wrong passcode. Teacher: teacher123, Student: student123");
  }

  return (
    <main className="login-page" ref={heroRef}>
      <section className="login-hero">
        <div className="ambient-ring one" />
        <div className="ambient-ring two" />
        <div className="brand-mark">TR</div>
        <p className="eyebrow">Digital story studio</p>
        <h1>Te Tahi-o-Te-Rā</h1>
        <p>Teachers shape interactive books. Students read, listen, answer, and learn with Kiri and Moko.</p>
      </section>
      <motion.form className="login-panel" onSubmit={submit} layout>
        <h2>Sign in</h2>
        <div className="segmented">
          <button type="button" className={role === "teacher" ? "active" : ""} onClick={() => setRole("teacher")}>Teacher</button>
          <button type="button" className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>Student</button>
        </div>
        <label>
          Passcode
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Enter passcode" autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit"><UserRound size={18} /> Enter</button>
      </motion.form>
    </main>
  );
}

function TeacherEditor({ book, books, setBooks, setBook, onLogout, onPreview }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [tab, setTab] = useState(tabs[0]);
  const page = book.pages[pageIndex];

  function updatePage(patch) {
    setBook((current) => ({
      ...current,
      pages: current.pages.map((item, index) => index === pageIndex ? { ...item, ...patch } : item),
    }));
  }

  function updateBook(patch) {
    setBook((current) => ({ ...current, ...patch }));
  }

  function updateNested(section, patch) {
    updatePage({ [section]: { ...page[section], ...patch } });
  }

  function addPage() {
    const next = {
      ...page,
      id: `page-${Date.now()}`,
      pageNumber: book.pages.length + 1,
      title: "New Page",
      content: { en: "Write the story here.", mi: "" },
      image: page.image,
      puzzle: { enabled: false, rows: 3, columns: 3 },
    };
    setBook({ ...book, pages: [...book.pages, next] });
    setPageIndex(book.pages.length);
  }

  function newBook() {
    const firstPage = {
      ...page,
      id: `page-${Date.now()}`,
      pageNumber: 1,
      title: "New Book",
      content: { en: "Start writing here.", mi: "" },
      ai: { cultureTerms: [], questions: [defaultQuestion()] },
      sprite: { kiriEnabled: true, mokoEnabled: true, mokoEmotion: "happy", pageReaction: "", correctReaction: "", incorrectReaction: "", reactionPreset: "warm", reactionMode: "ai", greetingMode: "ai", customGreetingPresets: {}, answerReactionMode: "simple", answerReactionPreset: "warm" },
      puzzle: { enabled: false, rows: 3, columns: 3 },
    };
    const created = {
      ...book,
      id: `book-${Date.now()}`,
      title: "New Book",
      subtitle: "Interactive story",
      author: "Teacher",
      pages: [firstPage],
      status: "draft",
    };
    upsertBook(created);
    setBook(created);
    setBooks(loadBooks());
    setPageIndex(0);
  }

  function deletePage(indexToDelete) {
    if (book.pages.length <= 1) return;
    const pages = book.pages
      .filter((_, index) => index !== indexToDelete)
      .map((item, index) => ({ ...item, pageNumber: index + 1 }));
    setBook({ ...book, pages });
    setPageIndex(Math.min(pageIndex, pages.length - 1));
  }

  function handleSave() {
    saveDraft(book);
    setBooks(loadBooks());
    setNotice("Draft saved");
  }

  function handlePublish() {
    const published = publishBook(book);
    setBook(published);
    setBooks(loadBooks());
    setNotice("Published");
  }

  const [notice, setNotice] = useState("");

  function addAudioFiles(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    }))).then((items) => {
      setBook({ ...book, bgm: [...(book.bgm || []), ...items] });
      setNotice(`${items.length} audio added`);
    });
  }

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar">
        <div className="side-title">
          <div className="mini-mark">TR</div>
          <div><strong>Te Tahi Editor</strong><span>Interactive book</span></div>
        </div>
        <button className="outline wide" onClick={newBook}><BookOpen size={16} /> New Book</button>
        <label className="book-select">Book
          <select value={book.id} onChange={(e) => {
            const selected = books.find((item) => item.id === e.target.value);
            if (selected) {
              setBook(selected);
              setPageIndex(0);
            }
          }}>
            {books.map((item) => <option key={item.id} value={item.id}>{item.title} {item.status === "published" ? "(published)" : "(draft)"}</option>)}
          </select>
        </label>
        <div className="side-heading"><span>Pages</span><button onClick={addPage} title="Add page"><Plus size={16} /></button></div>
        <div className="page-list">
          {book.pages.map((item, index) => (
            <div key={item.id} className={`page-row ${index === pageIndex ? "selected" : ""}`}>
              <button onClick={() => setPageIndex(index)}>
                <b>{item.pageNumber}</b><span>{item.title || `Page ${item.pageNumber}`}</span>
              </button>
              <button className="delete-page" disabled={book.pages.length <= 1} onClick={() => deletePage(index)} title="Delete page"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button className="outline wide" onClick={addPage}><Plus size={16} /> Add New Page</button>
        <div className="audio-add">
          <span>Audio</span>
          <label className="file-button"><Music size={17} /> Add audio files<input type="file" accept="audio/*" multiple onChange={addAudioFiles} /></label>
          <small>{(book.bgm || []).length} track(s), looped in student reader</small>
        </div>
      </aside>

      <section className="studio-main">
        <header className="studio-topbar">
          <button className="icon" onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}><ArrowLeft size={18} /></button>
          <span>Editing: Page {pageIndex + 1} of {book.pages.length}</span>
          <button className="icon" onClick={() => setPageIndex(Math.min(book.pages.length - 1, pageIndex + 1))}><ArrowRight size={18} /></button>
          <div className="top-actions">
            <button onClick={handleSave}><Save size={17} /> Save Draft</button>
            <button onClick={onPreview}><Eye size={17} /> Preview</button>
            <button className="publish" onClick={handlePublish}><Send size={17} /> Publish</button>
            <button onClick={onLogout}><LogOut size={17} /> Logout</button>
          </div>
          {notice && <span className="save-notice">{notice}</span>}
        </header>

        <div className="editor-grid">
          <section className="edit-panel">
            <div className="tabs">
              {tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}><TabLabel label={item} /></button>)}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.25 }}
              >
                {tab === "Content" && <ContentTab book={book} page={page} updateBook={updateBook} updatePage={updatePage} />}
                {tab === "AI & Questions" && <AiTab page={page} updateNested={updateNested} />}
                {tab === "Sprite Behavior" && <SpriteTab page={page} updateNested={updateNested} />}
              </motion.div>
            </AnimatePresence>
          </section>

          <aside className="preview-column">
            <h3>Live Preview</h3>
            <BookSpread page={page} language="en" compact />
          </aside>
        </div>
        <ProjectSettings book={book} setBook={setBook} setNotice={setNotice} />
      </section>
    </main>
  );
}

function AiMark() {
  return <span className="ai-highlight">AI</span>;
}

function TabLabel({ label }) {
  if (!label.includes("AI")) return label;
  return <><AiMark />{label.replace("AI", "")}</>;
}

function useReaderSounds() {
  const audioRef = useRef(null);

  function tone(frequency, duration = 0.16, type = "sine", gain = 0.05, delay = 0) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = audioRef.current || new AudioContext();
    audioRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume);
    volume.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  return {
    page: () => {
      tone(220, 0.08, "triangle", 0.03);
      tone(330, 0.12, "triangle", 0.025, 0.05);
    },
    chime: () => {
      tone(660, 0.09, "sine", 0.035);
      tone(880, 0.12, "sine", 0.03, 0.08);
    },
    correct: () => {
      tone(523, 0.08, "sine", 0.04);
      tone(784, 0.12, "sine", 0.04, 0.07);
      tone(1046, 0.14, "sine", 0.035, 0.14);
    },
    wrong: () => {
      tone(260, 0.12, "triangle", 0.035);
      tone(196, 0.14, "triangle", 0.025, 0.1);
    },
    star: () => {
      tone(988, 0.07, "sine", 0.035);
      tone(1318, 0.12, "sine", 0.03, 0.08);
    },
  };
}

function ProjectSettings({ book, setBook, setNotice }) {
  const [open, setOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState(book.settings || {});
  const [draftBgm, setDraftBgm] = useState((book.bgm || []).join("\n"));

  useEffect(() => {
    if (!open) {
      setDraftSettings(book.settings || {});
      setDraftBgm((book.bgm || []).join("\n"));
    }
  }, [book, open]);

  function updateSettings(patch) {
    setDraftSettings((current) => ({ ...current, ...patch }));
  }

  function saveAndClose() {
    setBook({
      ...book,
      settings: draftSettings,
      bgm: draftBgm.split("\n").map((item) => item.trim()).filter(Boolean),
    });
    setNotice?.("AI settings saved");
    setOpen(false);
  }

  return (
    <>
      <button className="floating-settings-button" onClick={() => setOpen(true)}><Settings size={17} /> <AiMark /> Settings</button>
      {open && (
        <div className="modal-backdrop">
          <motion.section className="settings-modal" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
            <div className="modal-head">
              <h3><AiMark /> Settings</h3>
              <button className="icon" onClick={() => setOpen(false)} aria-label="Close AI settings"><X size={18} /></button>
            </div>
            <div className="settings-grid">
              <label>Provider<select value={draftSettings.aiProvider || "offline"} onChange={(e) => updateSettings({ aiProvider: e.target.value })}>
                <option value="offline">Offline demo</option>
                <option value="groq">Groq</option>
                <option value="openai">OpenAI compatible</option>
              </select></label>
              <label>Model<input value={draftSettings.aiModel || ""} onChange={(e) => updateSettings({ aiModel: e.target.value })} placeholder="Model name" /></label>
              <label>Endpoint<input value={draftSettings.aiEndpoint || ""} onChange={(e) => updateSettings({ aiEndpoint: e.target.value })} placeholder="API endpoint" /></label>
              <label><span><AiMark /> Token</span><input type="password" value={draftSettings.aiToken || ""} onChange={(e) => updateSettings({ aiToken: e.target.value })} placeholder="Stored locally in this browser" /></label>
              <label>BGM Tracks<textarea rows="3" value={draftBgm} onChange={(e) => setDraftBgm(e.target.value)} /></label>
              <label>Kiri Sprite<select value={draftSettings.kiriSprite || "owl"} onChange={(e) => updateSettings({ kiriSprite: e.target.value })}>
                <option value="owl">Owl guardian</option>
                <option value="kiwi">Kiwi reader</option>
                <option value="star">Star spirit</option>
              </select></label>
              <label>Moko Sprite<select value={draftSettings.mokoSprite || "taniwha"} onChange={(e) => updateSettings({ mokoSprite: e.target.value })}>
                <option value="taniwha">Taniwha buddy</option>
                <option value="leaf">Leaf friend</option>
                <option value="shell">Shell helper</option>
              </select></label>
            </div>
            <div className="modal-actions">
              <button className="outline" onClick={() => setOpen(false)}>Close</button>
              <button className="primary" onClick={saveAndClose}><Save size={17} /> Save & Close</button>
            </div>
          </motion.section>
        </div>
      )}
    </>
  );
}

function ContentTab({ book, page, updateBook, updatePage }) {
  const hasPuzzleMedia = Boolean(page.image) && !String(page.image).toLowerCase().includes(".mp4");
  const isMp4 = Boolean(page.image) && String(page.image).toLowerCase().includes(".mp4");
  function chooseImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updatePage({ image: reader.result });
    reader.readAsDataURL(file);
  }

  function dictionaryTranslate() {
    const translated = page.content.en.split(/(\b)/).map((part) => dictionary[part.toLowerCase()] || part).join("");
    updatePage({ content: { ...page.content, mi: translated } });
  }

  function aiTranslate() {
    updatePage({ content: { ...page.content, mi: `[AI draft translation]\n${page.content.en}` } });
  }

  return (
    <div className="tab-body">
      <div className="project-fields">
        <label>Book Title<input value={book.title} onChange={(e) => updateBook({ title: e.target.value })} /></label>
        <label>Subtitle<input value={book.subtitle} onChange={(e) => updateBook({ subtitle: e.target.value })} /></label>
        <label>Author<input value={book.author} onChange={(e) => updateBook({ author: e.target.value })} /></label>
      </div>
      <label>Title<input value={page.title} onChange={(e) => updatePage({ title: e.target.value })} /></label>
      <div className="flat-page-editor">
        <label className="image-side">
          Illustration
          <MediaPreview src={page.image} title={page.title} />
          <div className="image-actions">
            <label className="file-button"><Upload size={16} /> Choose image<input type="file" accept="image/*,video/*" onChange={chooseImage} /></label>
            <input value={page.image?.startsWith("data:") ? "Selected local image" : page.image} onChange={(e) => updatePage({ image: e.target.value })} />
          </div>
        </label>
        <div className="text-side">
          <label>English Story Text<textarea rows="11" value={page.content.en} onChange={(e) => updatePage({ content: { ...page.content, en: e.target.value } })} /></label>
          <div className="translate-actions">
            <button onClick={dictionaryTranslate}>Dictionary Translate</button>
            <button onClick={aiTranslate}><Sparkles size={16} /> <AiMark /> Translate</button>
          </div>
          <label>Māori Story Text<textarea rows="5" value={page.content.mi} onChange={(e) => updatePage({ content: { ...page.content, mi: e.target.value } })} /></label>
          <div className="puzzle-settings">
            <label className="check"><input type="checkbox" disabled={!hasPuzzleMedia} checked={hasPuzzleMedia && (page.puzzle?.enabled || false)} onChange={(e) => updatePage({ puzzle: { ...(page.puzzle || {}), enabled: e.target.checked } })} /> Require image puzzle before this page</label>
            <label>Rows<input type="number" min="2" max="6" value={page.puzzle?.rows || 3} onChange={(e) => updatePage({ puzzle: { ...(page.puzzle || {}), rows: Number(e.target.value) } })} /></label>
            <label>Columns<input type="number" min="2" max="6" value={page.puzzle?.columns || 3} onChange={(e) => updatePage({ puzzle: { ...(page.puzzle || {}), columns: Number(e.target.value) } })} /></label>
            {!page.image && <small>No illustration: puzzle unavailable.</small>}
            {isMp4 && <small>MP4 needs a preview image before puzzle can be enabled.</small>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AiTab({ page, updateNested }) {
  const questions = page.ai?.questions?.length ? page.ai.questions : [defaultQuestion()];
  const [generatingTerms, setGeneratingTerms] = useState(false);

  function updateQuestions(next) {
    updateNested("ai", { questions: next });
  }

  function updateTerms(next) {
    updateNested("ai", { cultureTerms: next });
  }

  function updateQuestion(questionId, patch) {
    updateQuestions(questions.map((question) => question.id === questionId ? { ...question, ...patch } : question));
  }

  function addQuestion() {
    updateQuestions([...questions, defaultQuestion()]);
  }

  function deleteQuestion(questionId) {
    updateQuestions(questions.length === 1 ? [defaultQuestion()] : questions.filter((question) => question.id !== questionId));
  }

  function addAnswer(questionId) {
    updateQuestions(questions.map((question) => question.id === questionId
      ? { ...question, answers: [...question.answers, { id: String.fromCharCode(97 + question.answers.length), text: "", reaction: "" }] }
      : question));
  }

  function deleteAnswer(questionId, answerId) {
    updateQuestions(questions.map((question) => {
      if (question.id !== questionId) return question;
      const answers = question.answers.length <= 1 ? [{ id: "a", text: "", reaction: "" }] : question.answers.filter((answer) => answer.id !== answerId);
      return { ...question, answers, correctAnswerId: answers.some((item) => item.id === question.correctAnswerId) ? question.correctAnswerId : answers[0].id };
    }));
  }

  function generateQuestionAndAnswers(questionId) {
    const existingPrompts = new Set(questions
      .filter((question) => question.id !== questionId)
      .map((question) => normalizeText(question.prompt)));
    const currentQuestion = questions.find((question) => question.id === questionId);
    const keepCurrent = currentQuestion?.prompt && !existingPrompts.has(normalizeText(currentQuestion.prompt));
    const prompt = keepCurrent
      ? currentQuestion.prompt
      : buildQuestionCandidates(page).find((candidate) => !existingPrompts.has(normalizeText(candidate)))
        || `What is another important idea on this page about ${page.title}?`;
    const generated = answerSetFor(prompt);
    updateQuestions(questions.map((question) => {
      if (question.id !== questionId) return question;
      return {
        ...question,
        prompt,
        answers: generated.answers,
        correctAnswerId: generated.correctAnswerId,
      };
    }));
  }

  async function autoGenerateTerms() {
    if (page.ai?.cultureTermsGenerated) return;
    setGeneratingTerms(true);
    try {
      const offline = await loadOfflineAi(page.pageNumber);
      const existing = page.ai?.cultureTerms || [];
      const existingKeys = new Set(existing.map((item) => normalizeText(item.term)));
      const generated = generatedTermsForPage(page, offline.terms)
        .filter((item) => !existingKeys.has(normalizeText(item.term)));
      updateNested("ai", {
        cultureTerms: [...existing, ...generated].slice(0, 6),
        cultureTermsGenerated: true,
      });
    } finally {
      setGeneratingTerms(false);
    }
  }

  return (
    <div className="tab-body">
      <section className="qa-block">
        <div className="qa-head">
          <h4>Culture Terms</h4>
          <div className="qa-actions">
            <button disabled={page.ai?.cultureTermsGenerated || generatingTerms} onClick={autoGenerateTerms}><Sparkles size={16} /> Auto Generate Terms</button>
            <button onClick={() => updateTerms([...(page.ai?.cultureTerms || []), { term: "", explanation: "" }])}><Plus size={16} /> Term</button>
          </div>
        </div>
        {page.ai?.cultureTermsGenerated && <p className="helper-note">Auto-generated terms have already been used on this page.</p>}
        {(page.ai?.cultureTerms || []).map((term, index) => (
          <div className="answer-row" key={index}>
            <label>Term<input value={term.term} onChange={(e) => updateTerms((page.ai?.cultureTerms || []).map((item, itemIndex) => itemIndex === index ? { ...item, term: e.target.value } : item))} /></label>
            <label>Explanation<input value={term.explanation} onChange={(e) => updateTerms((page.ai?.cultureTerms || []).map((item, itemIndex) => itemIndex === index ? { ...item, explanation: e.target.value } : item))} /></label>
            <button className="danger" onClick={() => updateTerms((page.ai?.cultureTerms || []).filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /> Delete</button>
          </div>
        ))}
      </section>
      {questions.map((question, questionIndex) => (
        <section className="qa-block" key={question.id}>
          <div className="qa-head">
            <h4>Question {questionIndex + 1}</h4>
            <div className="qa-actions">
              <button onClick={() => generateQuestionAndAnswers(question.id)}><Sparkles size={16} /> Generate Question & Answers</button>
              <button className="danger" onClick={() => deleteQuestion(question.id)}><Trash2 size={15} /> Delete</button>
            </div>
          </div>
          <label>Question<input value={question.prompt} onChange={(e) => updateQuestion(question.id, { prompt: e.target.value })} /></label>
          {question.prompt && !question.answers.some((answer) => answer.text.trim()) && (
            <div className="empty-answer-note answer-empty-action">
              <span>No answers yet. Generate the question and answer options before publishing this quiz.</span>
              <button onClick={() => generateQuestionAndAnswers(question.id)}><Sparkles size={16} /> Generate Question & Answers</button>
            </div>
          )}
          {question.answers.map((answer, answerIndex) => (
            <div className="answer-row" key={answer.id}>
              <label>Answer {answerIndex + 1}<input value={answer.text} onChange={(e) => updateQuestion(question.id, { answers: question.answers.map((item) => item.id === answer.id ? { ...item, text: e.target.value } : item) })} /></label>
              <label>Reaction<input value={answer.reaction} onChange={(e) => updateQuestion(question.id, { answers: question.answers.map((item) => item.id === answer.id ? { ...item, reaction: e.target.value } : item) })} /></label>
              <button className="danger" onClick={() => deleteAnswer(question.id, answer.id)}><Trash2 size={15} /> Delete</button>
            </div>
          ))}
          <div className="qa-actions">
            <button onClick={() => addAnswer(question.id)}><Plus size={16} /> Answer</button>
            <label>Correct<select value={question.correctAnswerId} onChange={(e) => updateQuestion(question.id, { correctAnswerId: e.target.value })}>
              {question.answers.map((answer, index) => <option key={answer.id} value={answer.id}>Answer {index + 1}</option>)}
            </select></label>
          </div>
        </section>
      ))}
      <button className="outline" onClick={addQuestion}><Plus size={16} /> Add Question</button>
    </div>
  );
}

function SpriteTab({ page, updateNested }) {
  const sprite = page.sprite || {};
  const greetingMode = sprite.greetingMode || sprite.reactionMode || "ai";
  const answerMode = sprite.answerReactionMode || "simple";
  const selectedGreetingPreset = sprite.reactionPreset || "warm";
  const selectedAnswerPreset = answerReactionPresets[sprite.answerReactionPreset] ? sprite.answerReactionPreset : "warm";

  function updateGreetingPreset(value) {
    updateNested("sprite", {
      reactionPreset: selectedGreetingPreset,
      customGreetingPresets: {
        ...(sprite.customGreetingPresets || {}),
        [selectedGreetingPreset]: value,
      },
    });
  }

  function addGreetingPreset() {
    const id = `custom-${Date.now()}`;
    updateNested("sprite", {
      greetingMode: "preset",
      reactionMode: "preset",
      reactionPreset: id,
      customGreetingPresets: {
        ...(sprite.customGreetingPresets || {}),
        [id]: "Write a new page opening greeting.",
      },
    });
  }

  const greetingOptions = [
    ...reactionPresets.map((id) => [id, id]),
    ...Object.keys(sprite.customGreetingPresets || {}).map((id) => [id, `custom ${id.split("-").pop()}`]),
  ];
  const selectedGreetingText = sprite.customGreetingPresets?.[selectedGreetingPreset] || greetingPresetText[selectedGreetingPreset] || "";

  return (
    <div className="tab-body sprite-editor">
      <section className="qa-block">
        <div className="sprite-switches">
          <label className="check"><input type="checkbox" checked={sprite.kiriEnabled} onChange={(e) => updateNested("sprite", { kiriEnabled: e.target.checked })} /> Kiri learning tools</label>
          <label className="check"><input type="checkbox" checked={sprite.mokoEnabled} onChange={(e) => updateNested("sprite", { mokoEnabled: e.target.checked })} /> Moko encouragement sprite</label>
          <label>Emotion<select value={sprite.mokoEmotion} onChange={(e) => updateNested("sprite", { mokoEmotion: e.target.value })}>
            <option>happy</option><option>excited</option><option>confused</option><option>sad</option>
          </select></label>
        </div>
      </section>

      <section className="qa-block">
        <div className="qa-head">
          <h4>Page Opening Greeting</h4>
          <button onClick={addGreetingPreset}><Plus size={16} /> Add Preset</button>
        </div>
        <div className="project-fields">
          <label>Greeting Source<select className={greetingMode === "ai" ? "ai-select" : ""} value={greetingMode} onChange={(e) => updateNested("sprite", { greetingMode: e.target.value, reactionMode: e.target.value })}>
            <option value="default">Default greeting</option>
            <option value="preset">Use preset</option>
            <option value="custom">Write by hand</option>
            <option value="ai">AI reaction</option>
          </select></label>
          <label>Preset<select value={selectedGreetingPreset} disabled={greetingMode !== "preset"} onChange={(e) => updateNested("sprite", { reactionPreset: e.target.value })}>
            {greetingOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></label>
        </div>
        {greetingMode === "preset" && (
          <label>Edit Selected Preset<textarea rows="3" value={selectedGreetingText} onChange={(e) => updateGreetingPreset(e.target.value)} /></label>
        )}
        {greetingMode === "custom" && (
          <label>Handwritten Greeting<textarea rows="3" value={sprite.pageReaction || ""} onChange={(e) => updateNested("sprite", { pageReaction: e.target.value })} placeholder="Write what Moko says when this page opens." /></label>
        )}
        {greetingMode === "ai" && <p className="helper-note"><AiMark /> reaction uses the page text to create the opening line in reader mode.</p>}
      </section>

      <section className="qa-block">
        <h4>Reader Answer Reaction</h4>
        <div className="project-fields">
          <label>Feedback Source<select className={answerMode === "ai" ? "ai-select" : ""} value={answerMode} onChange={(e) => updateNested("sprite", { answerReactionMode: e.target.value })}>
            <option value="simple">Simple default</option>
            <option value="preset">Use preset</option>
            <option value="custom">Write by hand</option>
            <option value="ai">AI reaction</option>
          </select></label>
          <label>Preset<select value={selectedAnswerPreset} disabled={answerMode !== "preset"} onChange={(e) => updateNested("sprite", { answerReactionPreset: e.target.value })}>
            {Object.keys(answerReactionPresets).map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
        </div>
        {answerMode === "simple" && <p className="helper-note">Correct answers get a short encouragement. Wrong answers get a gentle try-again message.</p>}
        {answerMode === "preset" && (
          <div className="reaction-preview">
            <p><strong>Correct:</strong> {answerReactionPresets[selectedAnswerPreset].correct}</p>
            <p><strong>Wrong:</strong> {answerReactionPresets[selectedAnswerPreset].incorrect}</p>
          </div>
        )}
        {answerMode === "custom" && (
          <div className="two-col">
            <label>Correct Answer Reaction<textarea rows="4" value={sprite.correctReaction || ""} onChange={(e) => updateNested("sprite", { correctReaction: e.target.value })} /></label>
            <label>Wrong Answer Reaction<textarea rows="4" value={sprite.incorrectReaction || ""} onChange={(e) => updateNested("sprite", { incorrectReaction: e.target.value })} /></label>
          </div>
        )}
        {answerMode === "ai" && <p className="helper-note"><AiMark /> reaction uses the chosen answer and page context when the reader responds.</p>}
      </section>
    </div>
  );
}

function MediaTab({ page, updatePage, book, setBook }) {
  function imageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updatePage({ image: reader.result });
    reader.readAsDataURL(file);
  }

  return (
    <div className="tab-body media-grid">
      <label>Image or video path<input value={page.image} onChange={(e) => updatePage({ image: e.target.value })} /></label>
      <label className="upload-box"><Upload size={28} /> Upload preview image<input type="file" accept="image/*,video/*" onChange={imageUpload} /></label>
      <label>Audio path<input value={page.audio} onChange={(e) => updatePage({ audio: e.target.value })} /></label>
      <label>BGM tracks<textarea rows="4" value={(book.bgm || []).join("\n")} onChange={(e) => setBook({ ...book, bgm: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} /></label>
    </div>
  );
}

function StudentReader({ book, books, setBook, onLogout, onTeacher, canEdit }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [language, setLanguage] = useState(book.settings?.language || "en");
  const [visited, setVisited] = useState(new Set([1]));
  const [stars, setStars] = useState(0);
  const [flyingStars, setFlyingStars] = useState([]);
  const [unlockedPuzzles, setUnlockedPuzzles] = useState(new Set());
  const [pendingPuzzleIndex, setPendingPuzzleIndex] = useState(null);
  const [kiriHintReady, setKiriHintReady] = useState(false);
  const sounds = useReaderSounds();
  const page = book.pages[pageIndex];
  const publishedBooks = books.filter((item) => item.status === "published");

  useEffect(() => {
    setKiriHintReady(false);
    const delay = 4000 + Math.random() * 2000;
    const timer = window.setTimeout(() => {
      setKiriHintReady(true);
      sounds.chime();
      const bingo = new Audio(publicUrl("bgm/bingo.mp3"));
      bingo.volume = 0.35;
      bingo.play().catch(() => {});
    }, delay);
    return () => window.clearTimeout(timer);
  }, [page.id]);

  function go(next) {
    const index = Math.max(0, Math.min(book.pages.length - 1, next));
    if (index === pageIndex) return;
    const target = book.pages[index];
    const canPuzzle = target?.image && !String(target.image).toLowerCase().includes(".mp4");
    if (canPuzzle && target?.puzzle?.enabled && !unlockedPuzzles.has(target.id) && index !== pageIndex) {
      setPendingPuzzleIndex(index);
      return;
    }
    sounds.page();
    setPageIndex(index);
    setVisited((current) => new Set([...current, index + 1]));
  }

  function unlockPuzzle(index) {
    const target = book.pages[index];
    setUnlockedPuzzles((current) => new Set([...current, target.id]));
    setPendingPuzzleIndex(null);
    sounds.page();
    setPageIndex(index);
    setVisited((current) => new Set([...current, index + 1]));
  }

  function awardStars(amount, sourceEl) {
    sounds.star();
    setStars((value) => value + amount);
    const source = sourceEl?.getBoundingClientRect?.();
    const startX = source ? source.left + source.width / 2 : window.innerWidth / 2;
    const startY = source ? source.top + source.height / 2 : window.innerHeight / 2;
    const nextStars = Array.from({ length: amount }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      startX,
      startY,
      delay: index * 120,
    }));
    setFlyingStars((current) => [...current, ...nextStars]);
  }

  return (
    <main className="reader-shell">
      <header className="reader-top">
        <div><strong>{book.title}</strong><span>{book.subtitle}</span></div>
        <div className="reader-actions">
          <select value={book.id} onChange={(e) => {
            const selected = publishedBooks.find((item) => item.id === e.target.value);
            if (selected) {
              setBook(selected);
              setPageIndex(0);
            }
          }}>
            {[book, ...publishedBooks.filter((item) => item.id !== book.id)].map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="mi">Māori</option></select>
          {canEdit && <button onClick={onTeacher}>Editor</button>}
          <button onClick={onLogout}><LogOut size={16} /> Logout</button>
        </div>
      </header>
      <ProgressTracker visited={visited.size} total={book.pages.length} stars={stars} />
      {flyingStars.map((star) => (
        <span
          key={star.id}
          className="flying-star"
          style={{ left: star.startX, top: star.startY, animationDelay: `${star.delay}ms` }}
          onAnimationEnd={() => setFlyingStars((current) => current.filter((item) => item.id !== star.id))}
        >★</span>
      ))}
      <section className="reader-stage">
        <span className="book-rail left" />
        <BookSpread page={page} language={language} onPrev={() => go(pageIndex - 1)} onNext={() => go(pageIndex + 1)} />
        <span className="book-rail right" />
      </section>
      <div className="reader-footer">
        <button disabled={pageIndex === 0} onClick={() => go(pageIndex - 1)}><ArrowLeft size={18} /> Previous</button>
        <span>{pageIndex + 1} / {book.pages.length}</span>
        <button disabled={pageIndex === book.pages.length - 1} onClick={() => go(pageIndex + 1)}>Next <ArrowRight size={18} /></button>
      </div>
      <BgmPlayer tracks={book.bgm} />
      <KiriSprite
        page={page}
        sprite={book.settings?.kiriSprite || "owl"}
        hintReady={kiriHintReady}
        onHintConsumed={() => setKiriHintReady(false)}
        onStar={awardStars}
        onOpenSound={sounds.chime}
        onAnswerSound={(isCorrect) => (isCorrect ? sounds.correct() : sounds.wrong())}
      />
      <MokoBuddy page={page} sprite={book.settings?.mokoSprite || "taniwha"} />
      {pendingPuzzleIndex !== null && (
        <PuzzleGate
          page={book.pages[pendingPuzzleIndex]}
          onSolved={() => unlockPuzzle(pendingPuzzleIndex)}
          onClose={() => setPendingPuzzleIndex(null)}
          onStar={awardStars}
        />
      )}
    </main>
  );
}

function BookSpread({ page, language, compact, onPrev, onNext }) {
  const content = page.content?.[language] || page.content?.en || "";
  const isVideo = String(page.image).toLowerCase().includes(".mp4");
  const src = publicUrl(page.image);

  const audioRef = useRef(null);
  
  function playAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function speak(text) {
    if (!speechSynthesis || !text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = language === "mi" ? "mi-NZ" : "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  return (
    <section className={`book-spread ${compact ? "compact" : ""}`}>
      <button className="page-turn left" onClick={onPrev} aria-label="Previous page" />
      <div className="book-page art-page" onClick={compact ? undefined : onPrev}>
        <MediaPreview src={src} title={page.title} isVideo={isVideo} />
      </div>
      <article className="book-page text-page" onClick={compact ? undefined : onNext}>
        <h2>{page.title}</h2>
        <StoryText text={content} onSpeak={speak} />

        {page.pageNumber === 3 && (
          <div style={{ marginBottom: "10px" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              playAudio();
            }}
            className="primary"
          >
            ▶️ Play Audio
          </button>
            <audio
              ref={audioRef}
              src={publicUrl("audio/page3-read-aloud.m4a")}
              preload="auto"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </article>
      <button className="page-turn right" onClick={onNext} aria-label="Next page" />
    </section>
  );
}

function MediaPreview({ src, title, isVideo }) {
  const realSrc = publicUrl(src);
  if (!src) return <div className="empty-media">No image</div>;
  if (isVideo || String(src).toLowerCase().includes(".mp4")) return <video src={realSrc} autoPlay muted loop playsInline />;
  return <img src={realSrc} alt={title} />;
}

function StoryText({ text, onSpeak }) {
  return String(text || "").split(/\n+/).filter(Boolean).map((paragraph, index) => (
    <p key={index}>
      {paragraph.split(/(\s+)/).map((part, partIndex) => {
        if (/^\s+$/.test(part)) return part;
        return <button key={`${part}-${partIndex}`} className="word-button" onClick={(event) => {
          event.stopPropagation();
          onSpeak(part);
        }}>{part}</button>;
      })}
    </p>
  ));
}

function ProgressTracker({ visited, total, stars }) {
  return (
    <aside className="progress-card" id="ranking-card">
      <div className="tracker-row">
        <span className="tracker-icon">★</span>
        <span className="tracker-label">Travel</span>
        <div><span>{visited} / {total}</span><div className="bar"><i style={{ width: `${(visited / total) * 100}%` }} /></div></div>
      </div>
      <div className="tracker-row">
        <span className="tracker-icon">★</span>
        <span className="tracker-label">Te Tahi</span>
        <strong className="tracker-stars">{stars}</strong>
      </div>
    </aside>
  );
}

function KiriSprite({ page, sprite, hintReady, onHintConsumed, onStar, onOpenSound, onAnswerSound }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("terms");
  const [ai, setAi] = useState(null);
  const [viewedTerms, setViewedTerms] = useState(new Set());
  const enabled = page.sprite?.kiriEnabled !== false;

  useEffect(() => {
    setOpen(false);
    setAi(null);
    setViewedTerms(new Set());
  }, [page.id]);

  async function openPanel(nextMode = mode) {
    setMode(nextMode);
    setOpen(true);
    onHintConsumed?.();
    onOpenSound?.();
    if (!ai) setAi(await loadOfflineAi(page.pageNumber));
  }

  if (!enabled) return null;

  return (
    <aside className="sprite kiri">
      {hintReady && <button className="sprite-hint-badge sprite-bulb-glow" onClick={() => openPanel("quiz")} aria-label="Kiri has a question">💡</button>}
      <button className={`sprite-avatar kiri-avatar ${sprite}`} onClick={() => open ? setOpen(false) : openPanel(hintReady ? "quiz" : mode)} aria-label="Kiri sprite">
        <SpriteFace type={sprite} />
        <span>Kiri</span>
      </button>
      {open && (
        <div className="sprite-panel">
          <div className="sprite-tabs">
            <button className={mode === "terms" ? "active" : ""} onClick={() => openPanel("terms")}>Know</button>
            <button className={mode === "quiz" ? "active" : ""} onClick={() => openPanel("quiz")}>Think</button>
          </div>
          {!ai ? <p>Thinking...</p> : mode === "terms" ? (
            <div className="term-list">
              {(page.ai?.cultureTerms?.length ? page.ai.cultureTerms : ai.terms).map((term, index) => {
                const termKey = `${page.id}-${term.term}-${index}`;
                const viewed = viewedTerms.has(termKey);
                return (
                  <button
                    key={termKey}
                    className={viewed ? "viewed" : ""}
                    onClick={(event) => {
                      if (viewedTerms.has(termKey)) return;
                      setViewedTerms((current) => new Set([...current, termKey]));
                      onStar(1, event.currentTarget);
                    }}
                  >
                    <b>{term.term}</b>
                    <span>{term.explanation}</span>
                    {viewed && <em>Learned +1</em>}
                  </button>
                );
              })}
            </div>
          ) : (
            <Quiz page={page} ai={ai} onStar={onStar} onAnswerSound={onAnswerSound} />
          )}
        </div>
      )}
    </aside>
  );
}

function SpriteFace({ type }) {
  const faces = {
    kiwi: "🥝",
    star: "⭐",
    leaf: "🍃",
    shell: "🐚",
    taniwha: "😊",
    owl: "🦉",
  };
  return <span className="sprite-emoji-face">{faces[type] || faces.owl}</span>;
}

function Quiz({ page, ai, onStar, onAnswerSound }) {
  const [choice, setChoice] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [awardedQuestionIds, setAwardedQuestionIds] = useState(new Set());
  const configuredQuestions = page.ai?.questions?.filter((item) => item.prompt) || [];
  const configured = configuredQuestions[questionIndex];
  const question = configured?.prompt || ai.question;
  const hasConfiguredAnswers = configured?.answers?.some((item) => item.text);
  const answers = configured ? configured.answers.filter((item) => item.text) : ai.answers;
  const correct = configured?.correctAnswerId || answers[0]?.id;
  const questionId = configured?.id || `offline-page-${page.id || page.pageNumber}`;
  const selectedAnswer = answers.find((item) => item.id === choice);
  const correctAnswer = answers.find((item) => item.id === correct);
  const isChoiceCorrect = choice && choice === correct;
  const hasNextQuestion = Boolean(configuredQuestions[questionIndex + 1]);

  useEffect(() => {
    setChoice("");
  }, [questionId]);

  useEffect(() => {
    setQuestionIndex(0);
    setChoice("");
  }, [page.id]);

  return (
    <div className="quiz">
      {configuredQuestions.length > 1 && <span className="quiz-count">Question {questionIndex + 1} / {configuredQuestions.length}</span>}
      <h4>{question}</h4>
      {configured && !hasConfiguredAnswers && <p className="empty-answer-note">No answers have been added for this question yet.</p>}
      {answers.map((answer) => (
        <button
          key={answer.id}
          disabled={Boolean(choice)}
          className={[
            choice === answer.id ? "chosen" : "",
            choice && answer.id === correct ? "correct" : "",
            choice === answer.id && answer.id !== correct ? "wrong" : "",
          ].filter(Boolean).join(" ")}
          onClick={(event) => {
            const isCorrect = answer.id === correct;
            setChoice(answer.id);
            onAnswerSound?.(isCorrect);
            if (isCorrect && !awardedQuestionIds.has(questionId)) {
              onStar(2, event.currentTarget);
              setAwardedQuestionIds((current) => new Set([...current, questionId]));
            }
            document.dispatchEvent(new CustomEvent("reader:answerResult", {
              detail: {
                isCorrect,
                reaction: answer.reaction,
                sprite: page.sprite,
              },
            }));
          }}
        >
          {choice && answer.id === correct && <strong className="answer-status">Correct</strong>}
          {choice === answer.id && answer.id !== correct && <strong className="answer-status">Try again</strong>}
          <span>{answer.text}</span>
        </button>
      ))}
      {choice && (
        <div className={isChoiceCorrect ? "quiz-feedback correct" : "quiz-feedback wrong"}>
          <strong>{isChoiceCorrect ? "Correct!" : "Not quite."}</strong>
          <span>{selectedAnswer?.reaction || (isChoiceCorrect ? "Great thinking." : `The correct answer is: ${correctAnswer?.text || "the highlighted option"}.`)}</span>
        </div>
      )}
      {choice && hasNextQuestion && (
        <button className="primary next-question" onClick={() => {
          setQuestionIndex((current) => current + 1);
          setChoice("");
        }}>Next Question</button>
      )}
    </div>
  );
}

function MokoBuddy({ page, sprite }) {
  const [line, setLine] = useState("");

  useEffect(() => {
    let active = true;
    loadOfflineAi(page.pageNumber).then((ai) => {
      if (active) setLine(spriteGreeting(page.sprite, ai.reaction));
    });
    return () => {
      active = false;
    };
  }, [page]);

  useEffect(() => {
    function onAnswer(event) {
      const detail = event.detail || {};
      setLine(spriteAnswerReaction(detail.sprite, detail.isCorrect, detail.reaction));
    }
    document.addEventListener("reader:answerResult", onAnswer);
    return () => document.removeEventListener("reader:answerResult", onAnswer);
  }, []);

  if (page.sprite?.mokoEnabled === false) return null;

  return (
    <aside className={`sprite moko ${page.sprite?.mokoEmotion || "happy"}`}>
      <div className={`sprite-avatar moko-avatar ${sprite}`}><SpriteFace type={sprite} /><span>Moko</span></div>
      <p>{line}</p>
    </aside>
  );
}

function PuzzleGate({ page, onSolved, onClose, onStar }) {
  const [attempts, setAttempts] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const solvedRef = useRef(false);
  const imageSrc = publicUrl(page.image);

  function markAttempt() {
    const next = attempts + 1;
    setAttempts(next);
    if (next >= 3) onSolved();
  }

  function handleSolved(sourceEl) {
    if (solvedRef.current) return;
    solvedRef.current = true;
    onStar?.(3, sourceEl);
    window.setTimeout(onSolved, 650);
  }

  return (
    <div className="puzzle-backdrop">
      <motion.section className="puzzle-gate" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="qa-head">
          <div>
            <h3>{introDone ? "Complete the image puzzle" : "Oh what is this?"}</h3>
            <p>{introDone ? `Unlock ${page.title}. Drag each piece into its slot.` : "Have a try!!"}</p>
          </div>
          <button onClick={onClose}>Back</button>
        </div>
        <AnimatePresence mode="wait">
          {!introDone ? (
            <motion.div
              key="intro"
              className="puzzle-intro"
              initial={{ opacity: 0, y: 18, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.45 }}
              onAnimationComplete={() => window.setTimeout(() => setIntroDone(true), 850)}
            >
              <span>?</span>
              <strong>Oh what is this?</strong>
              <em>Have a try!!</em>
            </motion.div>
          ) : (
            <motion.div key="puzzle" className="jigsaw-wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <SlottedImagePuzzle imageSrc={imageSrc} rows={page.puzzle?.rows || 3} columns={page.puzzle?.columns || 3} onSolved={handleSolved} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="qa-actions">
          <button onClick={markAttempt}>Attempt failed ({attempts}/3)</button>
          <button className="outline" onClick={onSolved}>Release page</button>
        </div>
      </motion.section>
    </div>
  );
}

function SlottedImagePuzzle({ imageSrc, rows = 3, columns = 3, onSolved }) {
  const boardRef = useRef(null);
  const activeRef = useRef(null);
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  const [slotsByPiece, setSlotsByPiece] = useState([]);
  const [active, setActive] = useState(null);
  const total = rows * columns;

  useEffect(() => {
    const image = new Image();
    image.onload = () => setAspectRatio(image.width / image.height || 4 / 3);
    image.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const shuffled = Array.from({ length: total }, (_, index) => index).sort(() => Math.random() - 0.5);
    if (shuffled.length > 1 && shuffled.every((slot, piece) => slot === piece)) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    setSlotsByPiece(shuffled);
    setActive(null);
  }, [imageSrc, rows, columns, total]);

  function slotPosition(slot, rect) {
    const col = slot % columns;
    const row = Math.floor(slot / columns);
    return {
      x: (col / columns) * rect.width,
      y: (row / rows) * rect.height,
      width: rect.width / columns,
      height: rect.height / rows,
    };
  }

  function nearestSlot(x, y, rect) {
    const col = Math.max(0, Math.min(columns - 1, Math.floor((x / rect.width) * columns)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((y / rect.height) * rows)));
    return row * columns + col;
  }

  function startDrag(piece, event) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const pos = slotPosition(slotsByPiece[piece], rect);
    activeRef.current = {
      piece,
      offsetX: event.clientX - rect.left - pos.x,
      offsetY: event.clientY - rect.top - pos.y,
      x: pos.x,
      y: pos.y,
    };
    setActive({ piece, x: pos.x, y: pos.y });
  }

  function moveDrag(event) {
    if (!activeRef.current) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pieceWidth = rect.width / columns;
    const pieceHeight = rect.height / rows;
    const nextActive = {
      piece: activeRef.current.piece,
      x: Math.max(0, Math.min(rect.width - pieceWidth, event.clientX - rect.left - activeRef.current.offsetX)),
      y: Math.max(0, Math.min(rect.height - pieceHeight, event.clientY - rect.top - activeRef.current.offsetY)),
    };
    activeRef.current.x = nextActive.x;
    activeRef.current.y = nextActive.y;
    setActive(nextActive);
  }

  function endDrag(event) {
    if (!activeRef.current) return;
    const rect = boardRef.current?.getBoundingClientRect();
    const current = activeRef.current;
    activeRef.current = null;
    if (!rect) {
      setActive(null);
      return;
    }
    const pieceWidth = rect.width / columns;
    const pieceHeight = rect.height / rows;
    const targetSlot = nearestSlot(current.x + pieceWidth / 2, current.y + pieceHeight / 2, rect);
    const occupant = slotsByPiece.findIndex((slot, piece) => slot === targetSlot && piece !== current.piece);
    const nextSlots = [...slotsByPiece];
    if (occupant >= 0) nextSlots[occupant] = slotsByPiece[current.piece];
    nextSlots[current.piece] = targetSlot;
    setSlotsByPiece(nextSlots);
    setActive(null);
    if (nextSlots.every((slot, piece) => slot === piece)) onSolved(event.currentTarget);
  }

  if (!slotsByPiece.length) return null;

  return (
    <div
      ref={boardRef}
      className="snap-puzzle"
      style={{ aspectRatio }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {Array.from({ length: total }, (_, slot) => (
        <span
          key={slot}
          className="snap-slot"
          style={{ "--slot-col": slot % columns, "--slot-row": Math.floor(slot / columns), "--cols": columns, "--rows": rows }}
        />
      ))}
      {slotsByPiece.map((slot, piece) => {
        const isActive = active?.piece === piece;
        const col = slot % columns;
        const row = Math.floor(slot / columns);
        return (
          <button
            key={piece}
            type="button"
            className={`snap-piece ${slot === piece ? "placed" : ""} ${isActive ? "dragging" : ""}`}
            style={{
              "--cols": columns,
              "--rows": rows,
              "--piece-col": piece % columns,
              "--piece-row": Math.floor(piece / columns),
              left: isActive ? `${active.x}px` : `${(col / columns) * 100}%`,
              top: isActive ? `${active.y}px` : `${(row / rows) * 100}%`,
              backgroundPosition: `${(piece % columns) / (columns - 1) * 100}% ${Math.floor(piece / columns) / (rows - 1) * 100}%`,
              backgroundImage: `url(${imageSrc})`,
            }}
            onPointerDown={(event) => startDrag(piece, event)}
            aria-label={`Puzzle piece ${piece + 1}`}
          />
        );
      })}
    </div>
  );
}

function BgmPlayer({ tracks = [] }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const src = tracks[trackIndex] ? publicUrl(tracks[trackIndex]) : "";

  function tryPlay() {
    const audio = audioRef.current;
    if (!audio || !src) return;
    audio.play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      tryPlay();
    } else {
      audio.pause();
      setBlocked(false);
    }
  }, [playing, src]);

  useEffect(() => {
    if (!playing || !blocked) return undefined;
    const resume = () => tryPlay();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, [playing, blocked, src]);

  function togglePlaying() {
    const next = !playing;
    setPlaying(next);
    if (next) window.setTimeout(tryPlay, 0);
    else audioRef.current?.pause();
  }

  return (
    <div className="bgm-player">
      {tracks.length > 1 && <select value={trackIndex} onChange={(e) => setTrackIndex(Number(e.target.value))}>
        {tracks.map((track, index) => <option key={track} value={index}>{track.split("/").pop()}</option>)}
      </select>}
      <button className={playing ? "music-on" : ""} onClick={togglePlaying} title="Toggle music"><Music size={18} />{blocked ? "Start Music" : playing ? "Music On" : "Music Off"}</button>
      {src && <audio ref={audioRef} src={src} loop autoPlay={playing} />}
    </div>
  );
}

function PuzzleOverlay() {
  const [visible, setVisible] = useState(false);
  const [bank, setBank] = useState(["Te", "Tahi-o-Te-Rā", "is", "the", "guardian"].sort(() => Math.random() - 0.5));
  const [answer, setAnswer] = useState([]);
  const solved = answer.join(" ") === "Te Tahi-o-Te-Rā is the guardian";

  if (!visible) return <button className="puzzle-launch" onClick={() => setVisible(true)}>Puzzle</button>;

  return (
    <div className="puzzle-backdrop">
      <section className="puzzle-box">
        <h3>Arrange the sentence</h3>
        <div className="drop-zone">{answer.map((word) => <button key={word} onClick={() => {
          setAnswer(answer.filter((item) => item !== word));
          setBank([...bank, word]);
        }}>{word}</button>)}</div>
        <div className="word-bank">{bank.map((word) => <button key={word} onClick={() => {
          setBank(bank.filter((item) => item !== word));
          setAnswer([...answer, word]);
        }}>{word}</button>)}</div>
        {answer.length > 0 && <p className={solved ? "ok" : "error"}>{solved ? "Correct." : "Keep trying."}</p>}
        <button onClick={() => setVisible(false)}>Close</button>
      </section>
    </div>
  );
}

