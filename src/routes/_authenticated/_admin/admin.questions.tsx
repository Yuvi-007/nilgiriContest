import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Plus,
  Save,
  Trash2,
  Image as ImageIcon,
  Upload,
  X,
  Search,
  CheckCircle2,
  Eye,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, GlassCard } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/_admin/admin/questions")({
  head: () => ({ meta: [{ title: "Question bank — nilgiriContest admin" }] }),
  component: Questions,
});

const diffColor = { easy: "text-green", medium: "text-gold", hard: "text-orange" } as const;

type QuestionDraft = {
  id: string | null;
  type: "mcq" | "coding";
  title: string;
  body: string;
  optionsText: string;
  correctOption: string;
  difficulty: "easy" | "medium" | "hard";
  codeLanguage: string;
  testCasesText: string;
  imageUrl: string | null;
};

const emptyDraft: QuestionDraft = {
  id: null,
  type: "mcq",
  title: "",
  body: "",
  optionsText: "",
  correctOption: "0",
  difficulty: "easy",
  codeLanguage: "python",
  testCasesText: "[]",
  imageUrl: null,
};

type QuestionRow = {
  id: string;
  type: "mcq" | "coding";
  title: string;
  body: string;
  options: unknown;
  correct_option: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  code_language: string | null;
  test_cases: unknown;
  image_url: string | null;
  marks: number;
};

function draftFromQuestion(question: QuestionRow): QuestionDraft {
  return {
    id: question.id,
    type: question.type,
    title: question.title,
    body: question.body,
    optionsText: Array.isArray(question.options) ? question.options.join("\n") : "",
    correctOption: String(question.correct_option ?? 0),
    difficulty: question.difficulty ?? "easy",
    codeLanguage: question.code_language ?? "python",
    testCasesText: JSON.stringify(question.test_cases ?? [], null, 2),
    imageUrl: question.image_url ?? null,
  };
}

function Questions() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-questions"],
    queryFn: async (): Promise<QuestionRow[]> => {
      const { data } = await supabase
        .from("questions")
        .select("*")
        .order("type", { ascending: false })
        .order("marks");
      return ((data ?? []) as unknown) as QuestionRow[];
    },
  });

  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "mcq" | "easy" | "medium" | "hard">("all");
  const [previewQuestion, setPreviewQuestion] = useState<QuestionRow | null>(null);

  const filteredQuestions = useMemo(() => {
    return data.filter((q) => {
      const qText = `${q.title} ${q.body}`.toLowerCase();
      const matchesSearch = !search.trim() || qText.includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (typeFilter === "mcq") return q.type === "mcq";
      if (typeFilter === "easy") return q.type === "coding" && q.difficulty === "easy";
      if (typeFilter === "medium") return q.type === "coding" && q.difficulty === "medium";
      if (typeFilter === "hard") return q.type === "coding" && q.difficulty === "hard";
      return true;
    });
  }, [data, search, typeFilter]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please upload a valid image file (PNG, JPG, SVG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image size must be less than 5MB.");
      return;
    }

    setUploadingImage(true);
    setMessage(null);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `question-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("question-assets")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage.from("question-assets").getPublicUrl(fileName);
      setDraft((curr) => (curr ? { ...curr, imageUrl: pubData.publicUrl } : null));
      setMessage("Image uploaded successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveQuestion() {
    if (!draft) return;
    try {
      const testCases = draft.type === "coding" ? JSON.parse(draft.testCasesText || "[]") : [];
      if (!Array.isArray(testCases)) throw new Error("Test cases must be a JSON array.");
      const options =
        draft.type === "mcq"
          ? draft.optionsText
              .split("\n")
              .map((option) => option.trim())
              .filter(Boolean)
          : null;

      const payload: {
        _id?: string;
        _type?: "mcq" | "coding";
        _title?: string;
        _body?: string;
        _options?: string[];
        _correct_option?: number;
        _difficulty?: "easy" | "medium" | "hard";
        _code_language?: string;
        _test_cases?: Array<{ input: string; expected_output: string; is_hidden?: boolean }>;
        _image_url?: string;
      } = {
        _type: draft.type,
        _title: draft.title,
        _body: draft.body,
        _code_language: draft.codeLanguage,
        _test_cases: testCases,
      };

      if (draft.id) payload._id = draft.id;
      if (options && options.length > 0) payload._options = options;
      if (draft.type === "mcq" && draft.correctOption !== null && draft.correctOption !== "") {
        payload._correct_option = Number(draft.correctOption);
      }
      if (draft.type === "coding" && draft.difficulty) {
        payload._difficulty = draft.difficulty;
      }
      if (draft.imageUrl) payload._image_url = draft.imageUrl;

      const { error } = await supabase.rpc("admin_upsert_question", payload);

      if (error) {
        throw new Error(error.message);
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      setDraft(null);
      setMessage("Question saved successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Question could not be saved.");
    }
  }

  async function deleteQuestion(id: string) {
    if (!window.confirm("Delete this question? Published or assigned questions cannot be deleted."))
      return;
    const { error } = await supabase.rpc("admin_delete_question", { _question_id: id });
    setMessage(error ? error.message : "Question deleted.");
    if (!error) await queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
  }

  return (
    <>
      <PageHeader
        title="Question bank"
        subtitle="MCQ = 1 mark · Coding: Easy 3, Medium 5, Hard 7 · Images & Diagrams supported"
      >
        <Button
          onClick={() => {
            setDraft({ ...emptyDraft });
            setMessage(null);
          }}
          className="gap-2 font-semibold shadow-glow"
        >
          <Plus className="h-4 w-4" /> New question
        </Button>
      </PageHeader>

      {message && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-border bg-bg3 p-4 text-sm text-foreground">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Question Editor Card */}
      {draft && (
        <GlassCard className="mb-8 border-violet/30 shadow-2xl">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-bold">{draft.id ? "Edit question" : "Create new question"}</h2>
              <p className="text-xs text-muted-foreground">Add question prompt, options, code test cases, and diagrams.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Question Type
                <select
                  value={draft.type}
                  onChange={(event) =>
                    setDraft({ ...draft, type: event.target.value as QuestionDraft["type"] })
                  }
                  className="h-10 rounded-xl border border-border bg-bg3 px-3 text-sm text-foreground focus:border-cyan focus:outline-none"
                >
                  <option value="mcq">MCQ (Multiple Choice) — 1 mark</option>
                  <option value="coding">Coding Problem — 3, 5, or 7 marks</option>
                </select>
              </label>

              {draft.type === "coding" ? (
                <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                  Difficulty &amp; Marks
                  <select
                    value={draft.difficulty}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        difficulty: event.target.value as QuestionDraft["difficulty"],
                      })
                    }
                    className="h-10 rounded-xl border border-border bg-bg3 px-3 text-sm text-foreground focus:border-cyan focus:outline-none"
                  >
                    <option value="easy">Easy · 3 marks</option>
                    <option value="medium">Medium · 5 marks</option>
                    <option value="hard">Hard · 7 marks</option>
                  </select>
                </label>
              ) : (
                <div className="flex items-center text-xs text-muted-foreground pt-5">
                  <span className="rounded-full bg-cyan/10 px-3 py-1 font-mono text-cyan">Standard MCQ = 1 Mark</span>
                </div>
              )}
            </div>

            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              Question Title
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="e.g. Reverse a Linked List or SQL Primary Key Characteristics"
                className="h-11 rounded-xl border border-border bg-bg3 px-4 text-sm font-medium text-foreground focus:border-cyan focus:outline-none"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              Question Description &amp; Body
              <textarea
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                placeholder="Detailed problem statement, constraints, example inputs/outputs..."
                className="min-h-32 rounded-xl border border-border bg-bg3 p-4 font-mono text-sm leading-relaxed text-foreground focus:border-cyan focus:outline-none"
              />
            </label>

            {/* ── Image / Diagram Upload Widget ── */}
            <div className="rounded-xl border border-border/80 bg-bg3/50 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <ImageIcon className="h-4 w-4 text-cyan" /> Question Diagram / Image
                </span>
                {draft.imageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => setDraft((curr) => (curr ? { ...curr, imageUrl: null } : null))}
                  >
                    <X className="h-3 w-3 mr-1" /> Remove image
                  </Button>
                )}
              </div>

              {draft.imageUrl ? (
                <div className="mt-3 flex items-start gap-4">
                  <img
                    src={draft.imageUrl}
                    alt="Question Diagram"
                    className="max-h-48 max-w-sm rounded-lg border border-border object-contain bg-black/40 p-1"
                  />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Image attached</p>
                    <p className="mt-1 font-mono text-[11px] truncate max-w-xs">{draft.imageUrl}</p>
                    <p className="mt-2 text-green flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Will be displayed directly to students in the arena
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 p-6 text-center cursor-pointer transition-colors hover:border-cyan/50 hover:bg-cyan/5">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="mt-2 text-xs font-semibold text-foreground">
                      {uploadingImage ? "Uploading diagram..." : "Click or drag to upload question diagram"}
                    </span>
                    <span className="mt-1 text-[11px] text-muted-foreground">
                      PNG, JPG, SVG, WebP up to 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage}
                      onChange={(e) => void handleImageUpload(e)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {draft.type === "mcq" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                  Options (One per line)
                  <textarea
                    value={draft.optionsText}
                    onChange={(event) => setDraft({ ...draft, optionsText: event.target.value })}
                    placeholder={"Option A\nOption B\nOption C\nOption D"}
                    className="min-h-32 rounded-xl border border-border bg-bg3 p-4 font-mono text-sm"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                  Correct Option (0 for A, 1 for B, 2 for C, 3 for D)
                  <input
                    type="number"
                    min="0"
                    value={draft.correctOption}
                    onChange={(event) => setDraft({ ...draft, correctOption: event.target.value })}
                    className="h-11 rounded-xl border border-border bg-bg3 px-4 font-mono text-sm"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Index corresponds to line order: 0 = 1st option, 1 = 2nd option.
                  </span>
                </label>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                  Programming Language
                  <input
                    value={draft.codeLanguage}
                    onChange={(event) => setDraft({ ...draft, codeLanguage: event.target.value })}
                    className="h-11 rounded-xl border border-border bg-bg3 px-4 font-mono text-sm"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                  Test Cases JSON (Array of &#123;input, expected_output&#125;)
                  <textarea
                    value={draft.testCasesText}
                    onChange={(event) => setDraft({ ...draft, testCasesText: event.target.value })}
                    className="min-h-32 rounded-xl border border-border bg-bg3 p-4 font-mono text-xs leading-relaxed"
                  />
                </label>
              </div>
            )}

            <div className="mt-2 flex gap-3">
              <Button onClick={() => void saveQuestion()} className="gap-2 font-bold shadow-glow">
                <Save className="h-4 w-4" /> Save question
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search questions by keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-bg3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-cyan focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: `All (${data.length})` },
            { id: "mcq", label: "MCQs (1p)" },
            { id: "easy", label: "Easy (3p)" },
            { id: "medium", label: "Medium (5p)" },
            { id: "hard", label: "Hard (7p)" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTypeFilter(id as typeof typeFilter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                typeFilter === id
                  ? "bg-accent text-foreground font-bold shadow-sm"
                  : "text-muted-foreground hover:bg-bg3 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Question Cards Grid */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading questions...</p>
      ) : filteredQuestions.length === 0 ? (
        <GlassCard className="text-center py-12">
          <p className="text-muted-foreground font-medium">No questions matched your search/filter.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredQuestions.map((q) => (
            <GlassCard key={q.id} className="flex flex-col justify-between hover:border-border/80 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-3 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-violet/10 px-2 py-0.5 font-bold uppercase text-violet">
                      {q.type}
                    </span>
                    <span className={`font-semibold ${q.difficulty ? diffColor[q.difficulty] : "text-cyan"}`}>
                      {q.difficulty ? `${q.difficulty} · ` : ""}{q.marks} mark{q.marks > 1 ? "s" : ""}
                    </span>
                    {q.image_url && (
                      <span className="flex items-center gap-1 rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-bold text-cyan">
                        <ImageIcon className="h-2.5 w-2.5" /> Diagram
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setPreviewQuestion(q)}
                      title="Preview question"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setDraft(draftFromQuestion(q))}
                      title="Edit question"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => void deleteQuestion(q.id)}
                      title="Delete question"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <h3 className="mt-3 font-bold text-foreground line-clamp-1">{q.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">{q.body}</p>

                {q.image_url && (
                  <div className="mt-3">
                    <img
                      src={q.image_url}
                      alt="Thumbnail"
                      className="h-16 w-32 rounded-lg border border-border object-cover bg-black/40"
                    />
                  </div>
                )}
              </div>

              {Array.isArray(q.options) && (
                <ol className="mt-4 space-y-1 border-t border-border/50 pt-3 font-mono text-xs">
                  {(q.options as string[]).slice(0, 4).map((o, i) => (
                    <li
                      key={i}
                      className={`truncate ${i === q.correct_option ? "text-green font-semibold" : "text-muted-foreground"}`}
                    >
                      {String.fromCharCode(65 + i)}. {o}
                    </li>
                  ))}
                </ol>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Question Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono text-xs uppercase text-cyan font-bold">
                {previewQuestion.type} · {previewQuestion.marks} marks {previewQuestion.difficulty ? `(${previewQuestion.difficulty})` : ""}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewQuestion(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">{previewQuestion.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{previewQuestion.body}</p>

            {previewQuestion.image_url && (
              <div className="mt-4 rounded-xl border border-border bg-black/40 p-2">
                <img
                  src={previewQuestion.image_url}
                  alt="Diagram"
                  className="max-h-72 w-full rounded-lg object-contain"
                />
              </div>
            )}

            {Array.isArray(previewQuestion.options) && (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground">Options:</p>
                {(previewQuestion.options as string[]).map((opt, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 text-sm font-mono ${
                      i === previewQuestion.correct_option
                        ? "border-green/50 bg-green/10 text-green font-bold"
                        : "border-border bg-bg3 text-muted-foreground"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setPreviewQuestion(null)}>Close Preview</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
