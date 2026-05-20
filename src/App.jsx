import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Eye,
  FileImage,
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
  Volume2,
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
  "encouraging",
  "celebration",
  "curious",
  "gentle hint",
  "culture note",
  "try again",
  "page wonder",
];
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
      sprite: { kiriEnabled: true, mokoEnabled: true, mokoEmotion: "happy", pageReaction: "", correctReaction: "", incorrectReaction: "", reactionPreset: "encouraging", reactionMode: "ai" },
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
              {tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
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
                {tab === "AI & Questions" && <AiTab book={book} page={page} updateNested={updateNested} />}
                {tab === "Sprite Behavior" && <SpriteTab page={page} updateNested={updateNested} />}
              </motion.div>
            </AnimatePresence>
          </section>

          <aside className="preview-column">
            <h3>Live Preview</h3>
            <BookSpread page={page} language="en" compact />
            <div className="quick-actions">
              <button onClick={() => updateNested("ai", { cultureTerms: [{ term: "kaitiaki", explanation: "Guardian or caretaker." }] })}>Generate Terms</button>
              <button onClick={() => updateNested("ai", { question: "What does this page teach us about guardianship?" })}>Generate Question</button>
              <button onClick={() => updateNested("ai", { feedback: "A thoughtful answer with a strong link to the story." })}>Generate Feedback</button>
            </div>
          </aside>
        </div>
        <ProjectSettings book={book} setBook={setBook} />
      </section>
    </main>
  );
}

function ProjectSettings({ book, setBook }) {
  const [open, setOpen] = useState(false);
  const settings = book.settings || {};
  function updateSettings(patch) {
    setBook({ ...book, settings: { ...settings, ...patch } });
  }

  return (
    <section className={`settings-box collapsed-settings ${open ? "open" : ""}`}>
      <button className="settings-toggle" onClick={() => setOpen(!open)}><Sparkles size={17} /> AI Settings</button>
      {open && <>
      <label>Provider<select value={settings.aiProvider || "offline"} onChange={(e) => updateSettings({ aiProvider: e.target.value })}>
        <option value="offline">Offline demo</option>
        <option value="groq">Groq</option>
        <option value="openai">OpenAI compatible</option>
      </select></label>
      <label>Model<input value={settings.aiModel || ""} onChange={(e) => updateSettings({ aiModel: e.target.value })} placeholder="Model name" /></label>
      <label>Endpoint<input value={settings.aiEndpoint || ""} onChange={(e) => updateSettings({ aiEndpoint: e.target.value })} placeholder="API endpoint" /></label>
      <label>AI Token<input type="password" value={settings.aiToken || ""} onChange={(e) => updateSettings({ aiToken: e.target.value })} placeholder="Stored locally in this browser" /></label>
      <label>BGM Tracks<textarea rows="3" value={(book.bgm || []).join("\n")} onChange={(e) => setBook({ ...book, bgm: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} /></label>
      <label>Kiri Sprite<select value={settings.kiriSprite || "owl"} onChange={(e) => updateSettings({ kiriSprite: e.target.value })}>
        <option value="owl">Owl guardian</option>
        <option value="kiwi">Kiwi reader</option>
        <option value="star">Star spirit</option>
      </select></label>
      <label>Moko Sprite<select value={settings.mokoSprite || "taniwha"} onChange={(e) => updateSettings({ mokoSprite: e.target.value })}>
        <option value="taniwha">Taniwha buddy</option>
        <option value="leaf">Leaf friend</option>
        <option value="shell">Shell helper</option>
      </select></label>
      </>}
    </section>
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
            <button onClick={aiTranslate}><Sparkles size={16} /> AI Translate</button>
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

function AiTab({ book, page, updateNested }) {
  const questions = page.ai?.questions?.length ? page.ai.questions : [defaultQuestion()];
  const [toolMode, setToolMode] = useState("preset");
  const [preset, setPreset] = useState("question");
  const [customPrompt, setCustomPrompt] = useState("");
  const [contextMode, setContextMode] = useState("page");

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

  function generateFor(questionId) {
    const context = contextMode === "book"
      ? book.pages.map((item) => `${item.title}: ${item.content.en}`).join("\n")
      : contextMode === "page" ? `${page.title}\n${page.content.en}` : "";
    const prompt = toolMode === "custom" ? customPrompt : `Preset ${preset}: generate child-friendly ${preset} for ${page.title}. Context: ${context}`;
    updateQuestions(questions.map((question) => {
      if (question.id !== questionId) return question;
      if (preset === "answers") {
        return {
          ...question,
          answers: question.answers.map((answer, index) => ({
            ...answer,
            text: answer.text || [`Protect the people`, `Listen to the land`, `Work together`][index] || `Thoughtful answer`,
            reaction: answer.reaction || `Moko says: ${index === 0 ? "Great thinking!" : "Nice try, keep exploring."}`,
          })),
        };
      }
      if (preset === "reaction") {
        return {
          ...question,
          answers: question.answers.map((answer, index) => ({ ...answer, reaction: answer.reaction || `Reaction generated from: ${prompt.slice(0, 80)} (${index + 1})` })),
        };
      }
      return { ...question, prompt: question.prompt || `What does this page teach us about ${page.title}?` };
    }));
  }

  return (
    <div className="tab-body">
      <section className="ai-toolbox">
        <h4>AI Tool</h4>
        <div className="project-fields">
          <label>Mode<select value={toolMode} onChange={(e) => setToolMode(e.target.value)}><option value="preset">Preset module</option><option value="custom">Write prompt</option></select></label>
          <label>Preset<select value={preset} onChange={(e) => setPreset(e.target.value)}><option value="question">Question</option><option value="answers">Answers</option><option value="reaction">Answer reactions</option><option value="culture">Culture terms</option></select></label>
          <label>Context<select value={contextMode} onChange={(e) => setContextMode(e.target.value)}><option value="page">Send this page</option><option value="book">Send full book</option><option value="none">Prompt only</option></select></label>
        </div>
        {toolMode === "custom" && <label>User Prompt<textarea rows="3" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Write what you want the AI to generate..." /></label>}
      </section>
      <section className="qa-block">
        <div className="qa-head">
          <h4>Culture Terms</h4>
          <button onClick={() => updateTerms([...(page.ai?.cultureTerms || []), { term: "", explanation: "" }])}><Plus size={16} /> Term</button>
        </div>
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
              <button onClick={() => generateFor(question.id)}><Sparkles size={16} /> Generate</button>
              <button className="danger" onClick={() => deleteQuestion(question.id)}><Trash2 size={15} /> Delete</button>
            </div>
          </div>
          <label>Question<input value={question.prompt} onChange={(e) => updateQuestion(question.id, { prompt: e.target.value })} /></label>
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
  return (
    <div className="tab-body two-col">
      <label className="check"><input type="checkbox" checked={page.sprite.kiriEnabled} onChange={(e) => updateNested("sprite", { kiriEnabled: e.target.checked })} /> Kiri enabled</label>
      <label className="check"><input type="checkbox" checked={page.sprite.mokoEnabled} onChange={(e) => updateNested("sprite", { mokoEnabled: e.target.checked })} /> Moko enabled</label>
      <label>Emotion<select value={page.sprite.mokoEmotion} onChange={(e) => updateNested("sprite", { mokoEmotion: e.target.value })}>
        <option>happy</option><option>excited</option><option>confused</option><option>sad</option>
      </select></label>
      <label>Reaction Mode<select value={page.sprite.reactionMode || "ai"} onChange={(e) => updateNested("sprite", { reactionMode: e.target.value })}><option value="ai">AI reaction</option><option value="preset">Preset reaction</option><option value="custom">Custom text</option></select></label>
      <label>Preset<select value={page.sprite.reactionPreset || "encouraging"} onChange={(e) => updateNested("sprite", { reactionPreset: e.target.value })}>{reactionPresets.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Page Open Reaction<textarea rows="4" value={page.sprite.pageReaction || ""} onChange={(e) => updateNested("sprite", { pageReaction: e.target.value })} /></label>
      <label>Correct Answer Reaction<textarea rows="4" value={page.sprite.correctReaction || ""} onChange={(e) => updateNested("sprite", { correctReaction: e.target.value })} /></label>
      <label>Wrong Answer Reaction<textarea rows="4" value={page.sprite.incorrectReaction || ""} onChange={(e) => updateNested("sprite", { incorrectReaction: e.target.value })} /></label>
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
  const page = book.pages[pageIndex];
  const publishedBooks = books.filter((item) => item.status === "published");

  function go(next) {
    const index = Math.max(0, Math.min(book.pages.length - 1, next));
    const target = book.pages[index];
    const canPuzzle = target?.image && !String(target.image).toLowerCase().includes(".mp4");
    if (canPuzzle && target?.puzzle?.enabled && !unlockedPuzzles.has(target.id) && index !== pageIndex) {
      setPendingPuzzleIndex(index);
      return;
    }
    setPageIndex(index);
    setVisited((current) => new Set([...current, index + 1]));
  }

  function unlockPuzzle(index) {
    const target = book.pages[index];
    setUnlockedPuzzles((current) => new Set([...current, target.id]));
    setPendingPuzzleIndex(null);
    setPageIndex(index);
    setVisited((current) => new Set([...current, index + 1]));
  }

  function awardStars(amount, sourceEl) {
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
      <BookSpread page={page} language={language} onPrev={() => go(pageIndex - 1)} onNext={() => go(pageIndex + 1)} />
      <div className="reader-footer">
        <button disabled={pageIndex === 0} onClick={() => go(pageIndex - 1)}><ArrowLeft size={18} /> Previous</button>
        <span>{pageIndex + 1} / {book.pages.length}</span>
        <button disabled={pageIndex === book.pages.length - 1} onClick={() => go(pageIndex + 1)}>Next <ArrowRight size={18} /></button>
      </div>
      <BgmPlayer tracks={book.bgm} />
      <KiriSprite page={page} sprite={book.settings?.kiriSprite || "owl"} onStar={awardStars} />
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

function KiriSprite({ page, sprite, onStar }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("terms");
  const [ai, setAi] = useState(null);
  const enabled = page.sprite?.kiriEnabled !== false;

  useEffect(() => {
    setOpen(false);
    setAi(null);
  }, [page.id]);

  async function openPanel(nextMode = mode) {
    setMode(nextMode);
    setOpen(true);
    if (!ai) setAi(await loadOfflineAi(page.pageNumber));
  }

  if (!enabled) return null;

  return (
    <aside className="sprite kiri">
      <button className={`sprite-avatar kiri-avatar ${sprite}`} onClick={() => open ? setOpen(false) : openPanel()} aria-label="Kiri sprite">
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
              {(page.ai?.cultureTerms?.length ? page.ai.cultureTerms : ai.terms).map((term, index) => (
                <button key={`${term.term}-${index}`} onClick={(event) => onStar(1, event.currentTarget)}><b>{term.term}</b><span>{term.explanation}</span></button>
              ))}
            </div>
          ) : (
            <Quiz page={page} ai={ai} onStar={onStar} />
          )}
        </div>
      )}
    </aside>
  );
}

function SpriteFace({ type }) {
  if (type === "kiwi") return <span className="kiwi-face"><i /></span>;
  if (type === "star") return <span className="star-face">★</span>;
  if (type === "leaf") return <span className="leaf-face">◆</span>;
  if (type === "shell") return <span className="shell-face">◖</span>;
  if (type === "taniwha") return <span className="moko-face">☘</span>;
  return <span className="owl-face"><i /><i /></span>;
}

function Quiz({ page, ai, onStar }) {
  const [choice, setChoice] = useState("");
  const configured = page.ai?.questions?.find((item) => item.prompt);
  const question = configured?.prompt || ai.question;
  const answers = configured?.answers?.some((item) => item.text) ? configured.answers : ai.answers;
  const correct = configured?.correctAnswerId || answers[0]?.id;

  return (
    <div className="quiz">
      <h4>{question}</h4>
      {answers.map((answer) => (
        <button key={answer.id} className={choice === answer.id ? "chosen" : ""} onClick={() => {
          setChoice(answer.id);
          if (answer.id === correct) onStar(2, event.currentTarget);
          document.dispatchEvent(new CustomEvent("reader:answerResult", {
            detail: {
              isCorrect: answer.id === correct,
              reaction: answer.reaction,
              correctReaction: page.sprite?.correctReaction,
              incorrectReaction: page.sprite?.incorrectReaction,
            },
          }));
        }}>{answer.text}</button>
      ))}
      {choice && <p>{choice === correct ? "Great answer." : "Good thinking."} {answers.find((item) => item.id === choice)?.reaction || ai.feedback}</p>}
    </div>
  );
}

function MokoBuddy({ page, sprite }) {
  const [line, setLine] = useState("");

  useEffect(() => {
    let active = true;
    loadOfflineAi(page.pageNumber).then((ai) => {
      if (active) setLine(page.sprite?.pageReaction || ai.reaction);
    });
    return () => {
      active = false;
    };
  }, [page]);

  useEffect(() => {
    function onAnswer(event) {
      const detail = event.detail || {};
      setLine(detail.reaction || (detail.isCorrect ? detail.correctReaction : detail.incorrectReaction) || (detail.isCorrect ? "Yaaay! Amazing!" : "Great try. Keep going!"));
    }
    document.addEventListener("reader:answerResult", onAnswer);
    return () => document.removeEventListener("reader:answerResult", onAnswer);
  }, []);

  if (page.sprite?.mokoEnabled === false) return null;
  return <aside className={`sprite moko ${page.sprite?.mokoEmotion || "happy"}`}><div className={`sprite-avatar moko-avatar ${sprite}`}><SpriteFace type={sprite} /><span>Moko</span></div><p>{line}</p></aside>;
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
  const [trackIndex, setTrackIndex] = useState(0);
  const src = tracks[trackIndex] ? publicUrl(tracks[trackIndex]) : "";

  useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  if (playing) {
    audio.play().catch(() => setPlaying(false));
  } else {
    audio.pause();
  }
}, [playing]);

useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  audio.pause();
  audio.load();

  if (playing) {
    audio.play().catch(() => setPlaying(false));
  }
}, [src]);

  return (
    <div className="bgm-player">
      {tracks.length > 1 && <select value={trackIndex} onChange={(e) => setTrackIndex(Number(e.target.value))}>
        {tracks.map((track, index) => <option key={track} value={index}>{track.split("/").pop()}</option>)}
      </select>}
      <button onClick={() => setPlaying(!playing)} title="Toggle music"><Music size={18} />{playing ? "Pause" : "Play"}</button>
      {src && <audio ref={audioRef} src={src} loop />}
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

