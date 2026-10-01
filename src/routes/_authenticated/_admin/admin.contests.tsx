import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Send,
  Shield,
  Shuffle,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, PageHeader, StatusPill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { contestsQuery } from "@/lib/queries";
import { contestStatus, formatIST } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_admin/admin/contests")({
  head: () => ({ meta: [{ title: "Contests & Sets Manager — nilgiriContest admin" }] }),
  component: AdminContests,
});

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
  marks: number;
};

const emptyDraft: QuestionDraft = {
  id: null,
  type: "mcq",
  title: "",
  body: "",
  optionsText: "Option A\nOption B\nOption C\nOption D",
  correctOption: "0",
  difficulty: "easy",
  codeLanguage: "python",
  testCasesText: "[]",
  imageUrl: null,
  marks: 1,
};

type SetCode = "A" | "B" | "C";

const SET_COLORS: Record<SetCode, string> = {
  A: "text-cyan border-cyan/40 bg-cyan/10",
  B: "text-violet border-violet/40 bg-violet/10",
  C: "text-gold border-gold/40 bg-gold/10",
};
const SET_BADGE: Record<SetCode, string> = {
  A: "bg-cyan/20 text-cyan",
  B: "bg-violet/20 text-violet",
  C: "bg-gold/20 text-gold",
};

function diffTag(q: QuestionRow | QuestionDraft) {
  if (q.type === "mcq") return { label: "MCQ", cls: "bg-violet/15 text-violet" };
  const clsMap = {
    easy: "bg-green/15 text-green",
    medium: "bg-gold/15 text-gold",
    hard: "bg-orange/15 text-orange",
  } as const;
  return { label: q.difficulty ?? "coding", cls: clsMap[q.difficulty ?? "easy"] };
}

function CompositionStatus({ ids, questions }: { ids: string[]; questions: QuestionRow[] }) {
  const sel = questions.filter((q) => ids.includes(q.id));
  const mcq = sel.filter((q) => q.type === "mcq").length;
  const coding = sel.filter((q) => q.type === "coding").length;
  const marks = sel.reduce((t, q) => t + q.marks, 0);
  const easy = sel.filter((q) => q.difficulty === "easy").length;
  const med = sel.filter((q) => q.difficulty === "medium").length;
  const hard = sel.filter((q) => q.difficulty === "hard").length;
  const valid =
    sel.length === 8 &&
    mcq === 5 &&
    coding === 3 &&
    marks === 20 &&
    easy >= 1 &&
    med >= 1 &&
    hard >= 1;

  const items = [
    { label: "Total", value: `${sel.length}/8`, ok: sel.length === 8 },
    { label: "MCQs", value: `${mcq}/5`, ok: mcq === 5 },
    { label: "Coding", value: `${coding}/3`, ok: coding === 3 },
    { label: "Marks", value: `${marks}/20`, ok: marks === 20 },
    { label: "E/M/H", value: `${easy}/${med}/${hard}`, ok: easy >= 1 && med >= 1 && hard >= 1 },
  ];

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        valid ? "border-green/40 bg-green/5" : "border-border bg-bg3/60"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {valid ? (
          <CheckCircle2 className="h-4 w-4 text-green" />
        ) : (
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span
          className={`text-xs font-bold uppercase tracking-wider ${
            valid ? "text-green" : "text-muted-foreground"
          }`}
        >
          {valid ? "Valid Composition (Ready to Save/Publish)" : "Set Composition Check"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {items.map(({ label, value, ok }) => (
          <div
            key={label}
            className={`rounded-lg p-2 text-center text-xs border ${
              ok
                ? "border-green/30 bg-green/10 text-green"
                : "border-border bg-bg3 text-muted-foreground"
            }`}
          >
            <span className="block font-mono font-bold text-sm">{value}</span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Modal to Create or Edit any Question directly */
function QuestionEditorModal({
  draft,
  onClose,
  onSave,
}: {
  draft: QuestionDraft;
  onClose: () => void;
  onSave: (savedDraft: QuestionDraft) => Promise<void>;
}) {
  const [form, setForm] = useState<QuestionDraft>(draft);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMcq = form.type === "mcq";

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file (PNG, JPG, SVG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size must be less than 5MB.");
      return;
    }

    setUploadingImage(true);
    setErrorMsg(null);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `question-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("question-assets")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage.from("question-assets").getPublicUrl(fileName);
      setForm((curr) => ({ ...curr, imageUrl: pubData.publicUrl }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setErrorMsg("Title and problem description are required.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save question.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-bg2 p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
              {form.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">
                {form.id ? "Edit Question" : "Create New Question"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {form.id ? "Changes will update the question bank and all associated contests." : "New question will be created and added to the active set."}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Type switcher */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: "mcq", marks: 1 }))}
              className={`rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                isMcq ? "border-cyan bg-cyan/15 text-cyan" : "border-border text-muted-foreground hover:bg-bg3"
              }`}
            >
              Multiple Choice (MCQ · 1 Mark)
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: "coding", marks: f.difficulty === "easy" ? 2 : f.difficulty === "medium" ? 3 : 5 }))}
              className={`rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                !isMcq ? "border-cyan bg-cyan/15 text-cyan" : "border-border text-muted-foreground hover:bg-bg3"
              }`}
            >
              Coding Problem (Python 3)
            </button>
          </div>

          {/* Title & Marks */}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <label className="block">
              <span className="text-xs font-bold text-muted-foreground mb-1 block">Question Title</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Reverse a Linked List"
                className="w-full rounded-xl border border-border bg-bg3 px-3.5 py-2 text-sm focus:border-cyan focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-muted-foreground mb-1 block">Marks</span>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={form.marks}
                onChange={(e) => setForm((f) => ({ ...f, marks: Number(e.target.value) }))}
                className="w-full rounded-xl border border-border bg-bg3 px-3.5 py-2 text-sm text-center font-mono focus:border-cyan focus:outline-none"
              />
            </label>
          </div>

          {/* Coding Difficulty */}
          {!isMcq && (
            <div>
              <span className="text-xs font-bold text-muted-foreground mb-1 block">Coding Difficulty</span>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        difficulty: diff,
                        marks: diff === "easy" ? 2 : diff === "medium" ? 3 : 5,
                      }))
                    }
                    className={`rounded-xl border py-2 text-xs font-bold capitalize transition-colors ${
                      form.difficulty === diff
                        ? "border-cyan bg-cyan/15 text-cyan"
                        : "border-border text-muted-foreground hover:bg-bg3"
                    }`}
                  >
                    {diff} ({diff === "easy" ? "2m" : diff === "medium" ? "3m" : "5m"})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Problem Body */}
          <label className="block">
            <span className="text-xs font-bold text-muted-foreground mb-1 block">Problem Statement / Body</span>
            <textarea
              required
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="State the problem clearly, describe input/output formats, constraints, or question context..."
              className="w-full rounded-xl border border-border bg-bg3 p-3 text-sm focus:border-cyan focus:outline-none leading-relaxed"
            />
          </label>

          {/* Image Attachment */}
          <div className="rounded-xl border border-border/80 bg-bg3/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-cyan" /> Question Image Attachment (Optional)
              </span>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove image
                </button>
              )}
            </div>

            {form.imageUrl ? (
              <div className="relative rounded-lg border border-border/60 bg-black/40 p-2 flex justify-center">
                <img
                  src={form.imageUrl}
                  alt="Question Attachment"
                  className="max-h-40 w-auto rounded object-contain"
                />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/70 p-4 cursor-pointer hover:border-cyan/50 hover:bg-bg3/60 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-xs font-medium text-muted-foreground">
                  {uploadingImage ? "Uploading image..." : "Upload diagram, flowchart, or problem image"}
                </span>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">PNG, JPG, SVG, WebP up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* MCQ Options */}
          {isMcq ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-muted-foreground mb-1 block">
                  Options (one option per line)
                </span>
                <textarea
                  rows={4}
                  value={form.optionsText}
                  onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                  placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"
                  className="w-full rounded-xl border border-border bg-bg3 p-3 font-mono text-sm focus:border-cyan focus:outline-none"
                />
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground">Correct Option:</span>
                <div className="flex gap-2">
                  {form.optionsText
                    .split("\n")
                    .map((opt) => opt.trim())
                    .filter(Boolean)
                    .map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, correctOption: String(idx) }))}
                        className={`rounded-lg px-3 py-1 text-xs font-bold font-mono transition-colors border ${
                          form.correctOption === String(idx)
                            ? "border-green bg-green/20 text-green"
                            : "border-border text-muted-foreground hover:bg-bg3"
                        }`}
                      >
                        Option {String.fromCharCode(65 + idx)}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            /* Coding Test Cases */
            <div>
              <span className="text-xs font-bold text-muted-foreground mb-1 block">
                Test Cases (JSON format)
              </span>
              <textarea
                rows={4}
                value={form.testCasesText}
                onChange={(e) => setForm((f) => ({ ...f, testCasesText: e.target.value }))}
                placeholder='[{"input": "5\\n", "expected_output": "25\\n", "is_hidden": false}]'
                className="w-full rounded-xl border border-border bg-black/60 p-3 font-mono text-xs focus:border-cyan focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                Format: {'[{"input": "...", "expected_output": "...", "is_hidden": false}]'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploadingImage} className="gap-2 font-bold shadow-glow">
              {saving ? "Saving..." : form.id ? "Update Question" : "Create & Add to Set"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Modal to Preview a Question */
function QuestionPreviewModal({
  question,
  onClose,
}: {
  question: QuestionRow;
  onClose: () => void;
}) {
  const tag = diffTag(question);
  const options = Array.isArray(question.options) ? question.options : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-bg2 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${tag.cls}`}>
              {tag.label}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{question.marks} marks</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <h3 className="text-xl font-extrabold text-foreground">{question.title}</h3>

        {question.image_url && (
          <div className="mt-4 rounded-xl border border-border/80 bg-black/40 p-2 flex justify-center">
            <img
              src={question.image_url}
              alt={question.title}
              className="max-h-56 w-auto rounded object-contain"
            />
          </div>
        )}

        <p className="mt-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {question.body}
        </p>

        {question.type === "mcq" && (
          <div className="mt-5 space-y-2">
            {options.map((opt, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                  question.correct_option === idx
                    ? "border-green/50 bg-green/10 font-semibold text-green"
                    : "border-border bg-bg3/60 text-muted-foreground"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current font-mono text-xs font-bold">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{String(opt)}</span>
                {question.correct_option === idx && (
                  <span className="ml-auto text-xs font-bold">✓ Correct Answer</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Modal to pick & add existing questions from the Bank */
function QuestionBankPickerModal({
  activeSet,
  currentIds,
  questions,
  onToggleQuestion,
  onEditQuestion,
  onDeleteQuestion,
  onClose,
}: {
  activeSet: SetCode;
  currentIds: string[];
  questions: QuestionRow[];
  onToggleQuestion: (id: string) => void;
  onEditQuestion: (q: QuestionRow) => void;
  onDeleteQuestion: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "mcq" | "easy" | "medium" | "hard">("all");

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const qText = `${q.title} ${q.body}`.toLowerCase();
      const matchSearch = !search.trim() || qText.includes(search.toLowerCase());
      if (!matchSearch) return false;

      if (typeFilter === "mcq") return q.type === "mcq";
      if (typeFilter === "easy") return q.type === "coding" && q.difficulty === "easy";
      if (typeFilter === "medium") return q.type === "coding" && q.difficulty === "medium";
      if (typeFilter === "hard") return q.type === "coding" && q.difficulty === "hard";
      return true;
    });
  }, [questions, search, typeFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-bg2 p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan" /> Add Questions to Set {activeSet}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click "+ Add" on any question. Currently selected: {currentIds.length}/8
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & filter toolbar */}
        <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search questions by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-bg3 pl-10 pr-4 text-sm focus:border-cyan focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "mcq", "easy", "medium", "hard"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  typeFilter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-bg3"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Question List */}
        <div className="overflow-y-auto space-y-2 flex-1 pr-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No questions found matching your filter.
            </div>
          ) : (
            filtered.map((q) => {
              const inSet = currentIds.includes(q.id);
              const tag = diffTag(q);
              return (
                <div
                  key={q.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                    inSet ? "border-cyan/50 bg-cyan/5" : "border-border bg-bg3/50 hover:bg-bg3"
                  }`}
                >
                  <div
                    className={`h-6 w-6 shrink-0 rounded-lg border-2 flex items-center justify-center text-xs font-mono font-bold ${
                      inSet ? "border-cyan bg-cyan text-black" : "border-border"
                    }`}
                  >
                    {inSet ? currentIds.indexOf(q.id) + 1 : ""}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${tag.cls}`}>
                        {tag.label}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">{q.marks}m</span>
                      {q.image_url && <ImageIcon className="h-3 w-3 text-cyan/60" />}
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{q.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{q.body}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => onEditQuestion(q)}
                      title="Edit question in question bank"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => void onDeleteQuestion(q.id)}
                      title="Delete question permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={inSet ? "secondary" : "default"}
                      className={`h-7 text-xs font-bold ${
                        inSet ? "text-cyan border border-cyan/40 bg-cyan/10" : "shadow-sm"
                      }`}
                      onClick={() => onToggleQuestion(q.id)}
                    >
                      {inSet ? "Remove" : "+ Add"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border mt-4 shrink-0">
          <span className="font-mono text-xs text-muted-foreground">
            Set {activeSet}: {currentIds.length}/8 questions selected
          </span>
          <Button onClick={onClose} className="font-bold">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminContests() {
  const queryClient = useQueryClient();
  const { data: contests = [] } = useQuery(contestsQuery);
  const { data: questions = [], refetch: refetchQuestions } = useQuery<QuestionRow[]>({
    queryKey: ["admin-builder-questions"],
    queryFn: async (): Promise<QuestionRow[]> => {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .order("type", { ascending: false })
        .order("marks");
      if (error) throw error;
      return (data as unknown) as QuestionRow[];
    },
  });

  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [practice, setPractice] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Set management state
  const [activeSet, setActiveSet] = useState<SetCode>("A");
  const [setQuestions, setSetQuestions] = useState<Record<SetCode, string[]>>({
    A: [],
    B: [],
    C: [],
  });

  // Modals state
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [editorDraft, setEditorDraft] = useState<QuestionDraft | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionRow | null>(null);

  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const currentIds = setQuestions[activeSet];

  // Load contest questions when contest is selected
  useEffect(() => {
    if (!selectedContestId) {
      setSetQuestions({ A: [], B: [], C: [] });
      return;
    }
    void (async () => {
      const { data } = await supabase.rpc("admin_get_contest_questions", {
        _contest_id: selectedContestId,
      });
      const rows = data ?? [];
      const result: Record<SetCode, string[]> = { A: [], B: [], C: [] };
      for (const sc of ["A", "B", "C"] as SetCode[]) {
        result[sc] = rows
          .filter((r) => r.set_code === sc)
          .sort((a, b) => a.position - b.position)
          .map((r) => r.question_id);
      }
      setSetQuestions(result);
    })();
  }, [selectedContestId]);

  function toggleQuestion(id: string) {
    setSetQuestions((prev) => {
      const cur = prev[activeSet];
      if (cur.includes(id)) return { ...prev, [activeSet]: cur.filter((x) => x !== id) };
      if (cur.length >= 8) {
        setMessage({
          type: "err",
          text: `Set ${activeSet} already has 8 questions. Remove one first before adding another.`,
        });
        return prev;
      }
      return { ...prev, [activeSet]: [...cur, id] };
    });
  }

  function removeQuestion(id: string) {
    setSetQuestions((prev) => ({
      ...prev,
      [activeSet]: prev[activeSet].filter((x) => x !== id),
    }));
  }

  function moveQuestion(id: string, dir: "up" | "down") {
    setSetQuestions((prev) => {
      const cur = [...prev[activeSet]];
      const idx = cur.indexOf(id);
      if (idx < 0) return prev;
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= cur.length) return prev;
      const tmp = cur[idx]!;
      cur[idx] = cur[swapIdx]!;
      cur[swapIdx] = tmp;
      return { ...prev, [activeSet]: cur };
    });
  }

  function copyFromSetA() {
    if (setQuestions.A.length === 0) {
      return setMessage({
        type: "err",
        text: "Set A has no questions yet. Configure Set A first.",
      });
    }
    setSetQuestions((prev) => ({ ...prev, [activeSet]: [...prev.A] }));
    setMessage({
      type: "ok",
      text: `Copied ${setQuestions.A.length} questions from Set A into Set ${activeSet}! You can now swap or reorder questions.`,
    });
  }

  function shuffleFromSetA() {
    if (setQuestions.A.length !== 8) {
      return setMessage({
        type: "err",
        text: "Please configure all 8 questions in Set A first before shuffling.",
      });
    }
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const setAQuestions = setQuestions.A.map((id) => qMap.get(id)).filter(Boolean) as QuestionRow[];
    const mcqs = setAQuestions.filter((q) => q.type === "mcq").sort(() => Math.random() - 0.5);
    const coding = setAQuestions.filter((q) => q.type === "coding").sort(() => Math.random() - 0.5);

    const shuffled = [...mcqs.map((q) => q.id), ...coding.map((q) => q.id)];
    setSetQuestions((prev) => ({ ...prev, [activeSet]: shuffled }));
    setMessage({
      type: "ok",
      text: `Shuffled permutation from Set A applied to Set ${activeSet}!`,
    });
  }

  function autoFillSet(set: SetCode) {
    const mcqs = questions.filter((q) => q.type === "mcq").slice(0, 5);
    const easyCoding = questions.find((q) => q.type === "coding" && q.difficulty === "easy");
    const medCoding = questions.find((q) => q.type === "coding" && q.difficulty === "medium");
    const hardCoding = questions.find((q) => q.type === "coding" && q.difficulty === "hard");

    if (mcqs.length < 5 || !easyCoding || !medCoding || !hardCoding) {
      setMessage({
        type: "err",
        text: "Not enough questions in Question Bank. Need at least 5 MCQs and 1 Easy, 1 Medium, and 1 Hard coding question.",
      });
      return;
    }

    const picked = [...mcqs.map((q) => q.id), easyCoding.id, medCoding.id, hardCoding.id];
    setSetQuestions((prev) => ({ ...prev, [set]: picked }));
    setMessage({
      type: "ok",
      text: `Set ${set} auto-filled with valid 5 MCQs + 3 Coding (Easy, Med, Hard)! Now click "Save Set ${set}" or "Auto-Gen Sets B & C".`,
    });
  }

  async function handleSaveQuestion(draft: QuestionDraft) {
    let testCases: Array<{ input: string; expected_output: string; is_hidden?: boolean }> = [];
    if (draft.type === "coding") {
      try {
        const parsed = JSON.parse(draft.testCasesText || "[]");
        if (!Array.isArray(parsed)) throw new Error("Test cases must be a JSON array.");
        testCases = parsed;
      } catch (err) {
        throw new Error(`Invalid JSON test cases: ${(err as Error).message}`);
      }
    }

    const options =
      draft.type === "mcq"
        ? draft.optionsText
            .split("\n")
            .map((opt) => opt.trim())
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

    const { data: savedId, error } = await supabase.rpc("admin_upsert_question", payload);
    if (error) throw new Error(error.message);

    await refetchQuestions();

    // If new question, automatically add to active set if room
    if (!draft.id && savedId && typeof savedId === "string") {
      setSetQuestions((prev) => {
        const cur = prev[activeSet];
        if (cur.length < 8 && !cur.includes(savedId)) {
          return { ...prev, [activeSet]: [...cur, savedId] };
        }
        return prev;
      });
      setMessage({ type: "ok", text: `New question created and attached to Set ${activeSet}!` });
    } else {
      setMessage({ type: "ok", text: "Question updated successfully!" });
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!window.confirm("Permanently delete this question from the question bank?")) return;
    const { error } = await supabase.rpc("admin_delete_question", { _question_id: id });
    if (error) return setMessage({ type: "err", text: error.message });
    // Remove from all sets
    setSetQuestions((prev) => ({
      A: prev.A.filter((x) => x !== id),
      B: prev.B.filter((x) => x !== id),
      C: prev.C.filter((x) => x !== id),
    }));
    await refetchQuestions();
    setMessage({ type: "ok", text: "Question deleted from database." });
  }

  async function createDraft() {
    setMessage(null);
    if (!title || !startTime || !endTime) {
      return setMessage({ type: "err", text: "Title, start time, and end time are required." });
    }
    const { data, error } = await supabase.rpc("admin_create_draft_contest", {
      _title: title,
      _description: description,
      _start_time: new Date(startTime).toISOString(),
      _end_time: new Date(endTime).toISOString(),
      _duration_minutes: Number(duration),
      _is_practice: practice,
    });
    if (error) return setMessage({ type: "err", text: error.message });
    await queryClient.invalidateQueries({ queryKey: ["contests"] });
    setSelectedContestId((data as string) ?? null);
    setTitle("");
    setDescription("");
    setShowCreateForm(false);
    setMessage({
      type: "ok",
      text: "Draft contest created! Pick 8 questions for Set A, or use 'Auto-Fill Set A'.",
    });
  }

  async function saveSet(set: SetCode) {
    if (!selectedContestId) return;
    setSavingSet(true);
    setMessage(null);
    const { error } = await supabase.rpc("admin_set_contest_questions", {
      _contest_id: selectedContestId,
      _question_ids: setQuestions[set],
      _set_code: set,
    });
    setSavingSet(false);
    setMessage(
      error
        ? { type: "err", text: error.message }
        : { type: "ok", text: `Set ${set} saved successfully (${setQuestions[set].length} questions).` }
    );
  }

  async function autoGenerate() {
    if (!selectedContestId) return;
    if (setQuestions.A.length !== 8) {
      return setMessage({
        type: "err",
        text: "Please assign exactly 8 questions to Set A first before auto-generating Sets B & C.",
      });
    }

    setAutoGenLoading(true);
    setMessage(null);

    // 1. Ensure Set A is saved to DB first
    const { error: saveAError } = await supabase.rpc("admin_set_contest_questions", {
      _contest_id: selectedContestId,
      _question_ids: setQuestions.A,
      _set_code: "A",
    });
    if (saveAError) {
      setAutoGenLoading(false);
      return setMessage({ type: "err", text: `Failed to save Set A: ${saveAError.message}` });
    }

    // 2. Call admin_auto_generate_sets to shuffle into Sets B & C
    const { data, error } = await supabase.rpc("admin_auto_generate_sets", {
      _contest_id: selectedContestId,
    });
    if (error) {
      setAutoGenLoading(false);
      return setMessage({ type: "err", text: error.message });
    }

    // 3. Re-fetch all sets from DB so UI updates immediately
    const { data: rows2 } = await supabase.rpc("admin_get_contest_questions", {
      _contest_id: selectedContestId,
    });
    const rows = rows2 ?? [];
    const result: Record<SetCode, string[]> = { A: [], B: [], C: [] };
    for (const sc of ["A", "B", "C"] as SetCode[]) {
      result[sc] = rows
        .filter((r) => r.set_code === sc)
        .sort((a, b) => a.position - b.position)
        .map((r) => r.question_id);
    }
    setSetQuestions(result);
    setAutoGenLoading(false);
    setMessage({
      type: "ok",
      text:
        (data as { message?: string } | null)?.message ??
        "Sets B & C auto-generated with unique permutations! Ready to publish.",
    });
  }

  async function publish() {
    if (!selectedContestId) return;
    setPublishing(true);
    setMessage(null);

    // Auto-save any modified sets to DB before triggering publication
    for (const sc of ["A", "B", "C"] as SetCode[]) {
      if (setQuestions[sc].length === 8) {
        const { error: saveErr } = await supabase.rpc("admin_set_contest_questions", {
          _contest_id: selectedContestId,
          _question_ids: setQuestions[sc],
          _set_code: sc,
        });
        if (saveErr) {
          setPublishing(false);
          return setMessage({
            type: "err",
            text: `Failed to save Set ${sc}: ${saveErr.message}`,
          });
        }
      }
    }

    const { error } = await supabase.rpc("admin_publish_contest", {
      _contest_id: selectedContestId,
    });
    setPublishing(false);
    if (error) return setMessage({ type: "err", text: error.message });
    await queryClient.invalidateQueries({ queryKey: ["contests"] });
    setMessage({
      type: "ok",
      text: "🎉 Contest published and locked! Students will be deterministically assigned to Sets A, B, and C upon entry.",
    });
  }

  async function clone(contestId: string) {
    const { data, error } = await supabase.rpc("admin_clone_contest", { _source_id: contestId });
    if (error) return setMessage({ type: "err", text: error.message });
    await queryClient.invalidateQueries({ queryKey: ["contests"] });
    setSelectedContestId((data as string) ?? null);
    setMessage({
      type: "ok",
      text: "Contest cloned as a new draft! You can now adjust its dates or edit sets.",
    });
  }

  const selectedContest = contests.find((c) => c.id === selectedContestId);
  const setAValid = setQuestions.A.length === 8;
  const allSetsValid = (["A", "B", "C"] as SetCode[]).every((s) => setQuestions[s].length === 8);

  const qMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  return (
    <>
      <PageHeader
        title="Contests & Sets Manager"
        subtitle="Configure Sets A · B · C, add, edit, or remove questions with image attachments, and publish."
      >
        <Button
          onClick={() => setShowCreateForm((v) => !v)}
          className="gap-2 font-semibold shadow-glow"
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? "Cancel" : "New contest"}
        </Button>
      </PageHeader>

      {message && (
        <div
          className={`mb-5 flex items-center justify-between rounded-xl border p-4 text-sm ${
            message.type === "ok"
              ? "border-green/30 bg-green/10 text-green"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create Contest Draft Form */}
      {showCreateForm && (
        <GlassCard className="mb-6 border-cyan/20">
          <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/10">
              <Plus className="h-4 w-4 text-cyan" />
            </div>
            <div>
              <h2 className="font-bold">Create new contest draft</h2>
              <p className="text-xs text-muted-foreground">
                Fill details, save, then assign questions to Sets A, B, and C.
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contest title (e.g. Nilgiri Grand Challenge 2026)"
              className="h-11 rounded-xl border border-border bg-bg3 px-4 text-sm font-medium focus:border-cyan focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description / rules summary..."
              className="min-h-20 rounded-xl border border-border bg-bg3 p-4 text-sm focus:border-cyan focus:outline-none"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Starts (IST)
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-bg3 px-3 text-sm text-foreground focus:border-cyan focus:outline-none"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Ends (IST)
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-bg3 px-3 text-sm text-foreground focus:border-cyan focus:outline-none"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="h-9 w-20 rounded-xl border border-border bg-bg3 px-3 text-sm text-center font-mono focus:border-cyan focus:outline-none"
                />
                minutes duration
              </label>
              <label
                className="flex cursor-pointer items-center gap-2 text-sm font-medium select-none"
                onClick={() => setPractice((v) => !v)}
              >
                <div
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    practice ? "bg-cyan" : "bg-border"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      practice ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
                Practice mode
              </label>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => void createDraft()} className="gap-2 shadow-glow font-bold">
                <Plus className="h-4 w-4" /> Create draft
              </Button>
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Contests list */}
      <GlassCard className="mb-6 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-bold text-sm">Contests List</h2>
          <span className="text-xs text-muted-foreground">{contests.length} total</span>
        </div>
        {contests.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No contests yet. Click "+ New contest" above to create one.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {contests.map((c) => {
              const isSelected = selectedContestId === c.id;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    isSelected ? "bg-cyan/5 border-l-4 border-l-cyan" : "hover:bg-bg3/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">{c.title}</span>
                      {isSelected && (
                        <span className="text-[10px] rounded-full bg-cyan/20 text-cyan px-2 py-0.5 font-extrabold animate-pulse">
                          EDITING SETS
                        </span>
                      )}
                      {c.is_practice && (
                        <span className="text-[10px] rounded-full bg-gold/20 text-gold px-2 py-0.5 font-bold">
                          PRACTICE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {formatIST(c.start_time)} → {formatIST(c.end_time)} · {c.duration_minutes}m
                    </p>
                  </div>

                  <StatusPill status={contestStatus(c)} />

                  <div className="flex items-center gap-2 shrink-0">
                    {c.is_draft ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className={`h-8 gap-1.5 text-xs font-bold ${
                          isSelected
                            ? "bg-cyan text-black hover:bg-cyan/90 shadow-glow"
                            : "border-cyan/50 text-cyan hover:bg-cyan/10"
                        }`}
                        onClick={() => setSelectedContestId(isSelected ? null : c.id)}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        {isSelected ? "Close Editor" : "Assign Sets (A/B/C)"}
                      </Button>
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground px-2 py-1 rounded bg-bg3/60 border border-border/40">
                        Published (Locked)
                      </span>
                    )}

                    <Link
                      to="/admin/contests/$id/monitor"
                      params={{ id: c.id }}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan hover:bg-cyan/10 transition-colors"
                    >
                      Monitor
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => void clone(c.id)}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Clone
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* If no contest is selected, show guide */}
      {!selectedContestId && (
        <GlassCard className="p-8 text-center border-dashed border-cyan/30">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan/10 text-cyan mb-3">
            <Layers className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">Select a Contest to Configure Sets</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Click <strong className="text-cyan font-mono">"Assign Sets (A/B/C)"</strong> on any draft contest above to add, edit, reorder, or auto-generate questions for Sets A, B, and C.
          </p>
        </GlassCard>
      )}

      {/* Selected Contest Builder */}
      {selectedContestId && selectedContest && (
        <div className="space-y-6">
          {/* Workflow Stepper Header */}
          <div className="rounded-2xl border border-cyan/30 bg-gradient-to-r from-cyan/10 via-bg2 to-violet/10 p-5 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan animate-ping" />
                  <h2 className="text-lg font-extrabold text-foreground">
                    Editing Sets: "{selectedContest.title}"
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure Sets A, B, and C (5 MCQs + 3 Coding per set). Students are automatically assigned distinct sets.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => autoFillSet(activeSet)}
                  className="gap-1.5 font-bold border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Auto-Fill Set {activeSet}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void autoGenerate()}
                  disabled={!setAValid || autoGenLoading}
                  className="gap-1.5 font-bold border-violet/40 bg-violet/10 text-violet hover:bg-violet/20"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  {autoGenLoading ? "Generating..." : "Auto-Gen Sets B & C"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void publish()}
                  disabled={!allSetsValid || publishing}
                  className={`gap-1.5 font-bold ${
                    allSetsValid ? "bg-green hover:bg-green/80 text-black shadow-glow" : ""
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  {publishing ? "Publishing..." : "Publish Contest"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedContestId(null)}
                  className="h-8 text-xs text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Close
                </Button>
              </div>
            </div>

            {/* Step Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/40">
              <div
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs ${
                  setAValid
                    ? "border-green/40 bg-green/10 text-green"
                    : "border-cyan/40 bg-cyan/10 text-cyan"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/20 font-bold font-mono">
                  1
                </span>
                <div>
                  <p className="font-bold">Step 1: Set A ({setQuestions.A.length}/8)</p>
                  <p className="text-[10px] opacity-80">5 MCQs + 3 Coding (1E, 1M, 1H)</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs ${
                  setQuestions.B.length === 8 && setQuestions.C.length === 8
                    ? "border-green/40 bg-green/10 text-green"
                    : "border-border bg-bg3/60 text-muted-foreground"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/20 font-bold font-mono">
                  2
                </span>
                <div>
                  <p className="font-bold">
                    Step 2: Sets B & C ({setQuestions.B.length}/8, {setQuestions.C.length}/8)
                  </p>
                  <p className="text-[10px] opacity-80">Auto-shuffle or pick custom</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs ${
                  allSetsValid
                    ? "border-green/40 bg-green/10 text-green"
                    : "border-border bg-bg3/60 text-muted-foreground"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/20 font-bold font-mono">
                  3
                </span>
                <div>
                  <p className="font-bold">Step 3: Publish & Lock</p>
                  <p className="text-[10px] opacity-80">
                    {allSetsValid ? "All 3 sets valid and ready!" : "All sets must pass composition"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Builder Layout */}
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            {/* Left: active set questions & control */}
            <div className="space-y-4">
              <GlassCard className="p-0 overflow-hidden">
                {/* Active Set Switcher */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3 gap-3 flex-wrap bg-bg2/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-muted-foreground">
                      Active Set:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(["A", "B", "C"] as SetCode[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setActiveSet(s)}
                          className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all border ${
                            activeSet === s
                              ? SET_COLORS[s]
                              : "text-muted-foreground border-transparent hover:border-border hover:bg-bg3"
                          }`}
                        >
                          Set {s}
                          <span
                            className={`ml-1.5 rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold ${SET_BADGE[s]}`}
                          >
                            {setQuestions[s].length}/8
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick actions for Sets B and C */}
                  {activeSet !== "A" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs font-semibold gap-1"
                        onClick={copyFromSetA}
                        title="Copy Set A questions into this set"
                      >
                        <Copy className="h-3 w-3" /> Copy from Set A
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs font-semibold gap-1"
                        onClick={shuffleFromSetA}
                        title="Shuffle Set A questions into this set"
                      >
                        <Shuffle className="h-3 w-3" /> Shuffle from Set A
                      </Button>
                    </div>
                  )}
                </div>

                {/* Toolbar inside Set */}
                <div className="flex items-center justify-between border-b border-border/50 px-5 py-3 bg-bg3/30 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-foreground">
                      Set {activeSet} Questions ({currentIds.length}/8)
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      — Shown in exact sequence to students
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setShowPickerModal(true)}
                      className="h-8 gap-1.5 text-xs font-bold bg-cyan text-black hover:bg-cyan/90"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add from Question Bank
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditorDraft(emptyDraft)}
                      className="h-8 gap-1.5 text-xs font-bold"
                    >
                      <Plus className="h-3.5 w-3.5" /> Create New Question
                    </Button>
                  </div>
                </div>

                {/* Questions List */}
                <div className="p-4 space-y-2.5">
                  {currentIds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-muted-foreground text-xs leading-relaxed">
                      <p className="font-bold text-foreground text-sm">No questions in Set {activeSet} yet.</p>
                      <p className="mt-1">
                        Click <strong>"+ Add from Question Bank"</strong> to pick existing questions, or <strong>"Auto-Fill Set {activeSet}"</strong> for an instant valid 8-question set.
                      </p>
                      <div className="mt-4 flex justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => setShowPickerModal(true)}
                          className="gap-1.5 text-xs font-bold"
                        >
                          <Plus className="h-3.5 w-3.5" /> Open Question Bank
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => autoFillSet(activeSet)}
                          className="gap-1.5 text-xs font-bold"
                        >
                          <Wand2 className="h-3.5 w-3.5 text-cyan" /> Auto-Fill (5 MCQ + 3 Coding)
                        </Button>
                      </div>
                    </div>
                  ) : (
                    currentIds.map((id, index) => {
                      const q = qMap.get(id);
                      if (!q) return null;
                      const tag = diffTag(q);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-bg3/40 p-3 hover:border-cyan/40 transition-colors"
                        >
                          {/* Reorder arrows */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-bg3 disabled:opacity-20 transition-colors"
                              onClick={() => moveQuestion(id, "up")}
                              disabled={index === 0}
                              title="Move question up"
                            >
                              <ChevronUp className="h-3.5 w-3.5 mx-auto" />
                            </button>
                            <button
                              type="button"
                              className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-bg3 disabled:opacity-20 transition-colors"
                              onClick={() => moveQuestion(id, "down")}
                              disabled={index === currentIds.length - 1}
                              title="Move question down"
                            >
                              <ChevronDown className="h-3.5 w-3.5 mx-auto" />
                            </button>
                          </div>

                          {/* Position Badge */}
                          <div className="h-6 w-6 shrink-0 rounded-lg bg-cyan text-black flex items-center justify-center text-xs font-bold font-mono">
                            {index + 1}
                          </div>

                          {/* Question thumbnail if image exists */}
                          {q.image_url ? (
                            <div
                              onClick={() => setPreviewQuestion(q)}
                              className="h-10 w-10 shrink-0 rounded-lg border border-border bg-black/40 overflow-hidden cursor-pointer flex items-center justify-center hover:border-cyan"
                              title="Click to view image attachment"
                            >
                              <img
                                src={q.image_url}
                                alt="thumb"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 shrink-0 rounded-lg border border-border/50 bg-bg3 flex items-center justify-center text-muted-foreground text-xs font-bold">
                              {q.type === "mcq" ? "MCQ" : "</>"}
                            </div>
                          )}

                          {/* Question Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${tag.cls}`}>
                                {tag.label}
                              </span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {q.marks} mark{q.marks === 1 ? "" : "s"}
                              </span>
                              {q.image_url && (
                                <span className="flex items-center gap-1 text-[10px] font-mono text-cyan bg-cyan/10 px-1.5 py-0.2 rounded">
                                  <ImageIcon className="h-2.5 w-2.5" /> Image
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-foreground line-clamp-1">{q.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{q.body}</p>
                          </div>

                          {/* Action Buttons: Preview, Edit, Remove */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setPreviewQuestion(q)}
                              title="Preview question as student"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-cyan"
                              onClick={() =>
                                setEditorDraft({
                                  id: q.id,
                                  type: q.type,
                                  title: q.title,
                                  body: q.body,
                                  optionsText: Array.isArray(q.options) ? q.options.join("\n") : "",
                                  correctOption: String(q.correct_option ?? 0),
                                  difficulty: q.difficulty ?? "easy",
                                  codeLanguage: q.code_language ?? "python",
                                  testCasesText: q.test_cases
                                    ? JSON.stringify(q.test_cases, null, 2)
                                    : "[]",
                                  imageUrl: q.image_url,
                                  marks: q.marks,
                                })
                              }
                              title="Edit question details and attachments"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeQuestion(q.id)}
                              title="Remove from this set"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </GlassCard>

              {/* Save Active Set Button */}
              <div className="flex items-center justify-between p-1">
                <Button
                  onClick={() => void saveSet(activeSet)}
                  disabled={savingSet}
                  variant="secondary"
                  className="gap-2 font-bold"
                >
                  <ListChecks className="h-4 w-4 text-cyan" />
                  {savingSet ? "Saving Set..." : `Save Set ${activeSet} (${currentIds.length}/8)`}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Saves question order and composition for Set {activeSet}.
                </span>
              </div>
            </div>

            {/* Right Sidebar: Composition check & Publish */}
            <div className="space-y-4">
              <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-cyan" />
                  <h3 className="font-bold text-sm">Set {activeSet} Composition</h3>
                </div>
                <CompositionStatus ids={currentIds} questions={questions} />
              </GlassCard>

              <GlassCard>
                <h3 className="font-bold text-sm mb-3">All Sets Overview</h3>
                <div className="space-y-2">
                  {(["A", "B", "C"] as SetCode[]).map((s) => (
                    <div
                      key={s}
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                        activeSet === s
                          ? SET_COLORS[s]
                          : "border-border bg-bg3/50 hover:bg-bg3"
                      }`}
                      onClick={() => setActiveSet(s)}
                    >
                      <div>
                        <span className="font-bold text-sm">Set {s}</span>
                        <p className="text-[11px] text-muted-foreground">
                          {s === "A" ? "Base configuration" : "Permutation set"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold">
                          {setQuestions[s].length}/8
                        </span>
                        {setQuestions[s].length === 8 ? (
                          <CheckCircle2 className="h-4 w-4 text-green" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="border-violet/20">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="h-4 w-4 text-violet" />
                  <h3 className="font-bold text-sm text-violet">Auto-Generate Sets B & C</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Once Set A has 8 questions, auto-generate randomized permutations for Sets B & C with 1 click.
                </p>
                <Button
                  onClick={() => void autoGenerate()}
                  disabled={!setAValid || autoGenLoading}
                  className="w-full gap-2 font-bold bg-violet hover:bg-violet/80 text-white"
                >
                  <Shuffle className="h-4 w-4" />
                  {autoGenLoading ? "Generating..." : "Auto-Generate Sets B & C"}
                </Button>
                {!setAValid && (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    Assign all 8 questions to Set A first.
                  </p>
                )}
              </GlassCard>

              <GlassCard className={allSetsValid ? "border-green/30" : ""}>
                <div className="flex items-center gap-2 mb-2">
                  <Send className="h-4 w-4 text-green" />
                  <h3 className="font-bold text-sm">Publish Contest</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Locks the contest and enables student entrance. All 3 sets must be complete.
                </p>
                <Button
                  onClick={() => void publish()}
                  disabled={!allSetsValid || publishing}
                  className={`w-full gap-2 font-bold ${
                    allSetsValid
                      ? "bg-green hover:bg-green/80 text-black shadow-glow"
                      : ""
                  }`}
                >
                  <Send className="h-4 w-4" />
                  {publishing ? "Publishing..." : "Publish & Lock Contest"}
                </Button>
                {!allSetsValid && (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    Sets A, B, and C must each have 8 questions.
                  </p>
                )}
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {/* Question Bank Picker Modal */}
      {showPickerModal && (
        <QuestionBankPickerModal
          activeSet={activeSet}
          currentIds={currentIds}
          questions={questions}
          onToggleQuestion={toggleQuestion}
          onEditQuestion={(q) => {
            setShowPickerModal(false);
            setEditorDraft({
              id: q.id,
              type: q.type,
              title: q.title,
              body: q.body,
              optionsText: Array.isArray(q.options) ? q.options.join("\n") : "",
              correctOption: String(q.correct_option ?? 0),
              difficulty: q.difficulty ?? "easy",
              codeLanguage: q.code_language ?? "python",
              testCasesText: q.test_cases ? JSON.stringify(q.test_cases, null, 2) : "[]",
              imageUrl: q.image_url,
              marks: q.marks,
            });
          }}
          onDeleteQuestion={handleDeleteQuestion}
          onClose={() => setShowPickerModal(false)}
        />
      )}

      {/* Question Editor Modal */}
      {editorDraft && (
        <QuestionEditorModal
          draft={editorDraft}
          onClose={() => setEditorDraft(null)}
          onSave={handleSaveQuestion}
        />
      )}

      {/* Question Preview Modal */}
      {previewQuestion && (
        <QuestionPreviewModal
          question={previewQuestion}
          onClose={() => setPreviewQuestion(null)}
        />
      )}
    </>
  );
}
