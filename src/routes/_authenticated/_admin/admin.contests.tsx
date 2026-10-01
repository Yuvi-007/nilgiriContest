import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Shield,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui-kit";
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

const SET_THEME: Record<
  SetCode,
  {
    border: string;
    bg: string;
    text: string;
    badge: string;
    activeTab: string;
    glow: string;
  }
> = {
  A: {
    border: "border-cyan/40",
    bg: "bg-cyan/10",
    text: "text-cyan",
    badge: "bg-cyan/20 text-cyan border-cyan/40",
    activeTab: "bg-cyan text-black shadow-glow font-extrabold",
    glow: "shadow-[0_0_20px_-5px_rgba(34,201,245,0.3)]",
  },
  B: {
    border: "border-violet/40",
    bg: "bg-violet/10",
    text: "text-violet",
    badge: "bg-violet/20 text-violet border-violet/40",
    activeTab: "bg-violet text-white shadow-glow font-extrabold",
    glow: "shadow-[0_0_20px_-5px_rgba(91,140,255,0.3)]",
  },
  C: {
    border: "border-gold/40",
    bg: "bg-gold/10",
    text: "text-gold",
    badge: "bg-gold/20 text-gold border-gold/40",
    activeTab: "bg-gold text-black shadow-glow font-extrabold",
    glow: "shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]",
  },
};

function diffTag(q: QuestionRow | QuestionDraft) {
  if (q.type === "mcq") return { label: "MCQ", cls: "bg-violet/15 text-violet border-violet/30" };
  const clsMap = {
    easy: "bg-green/15 text-green border-green/30",
    medium: "bg-gold/15 text-gold border-gold/30",
    hard: "bg-orange/15 text-orange border-orange/30",
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
    { label: "Questions", value: `${sel.length}/8`, ok: sel.length === 8 },
    { label: "MCQs", value: `${mcq}/5`, ok: mcq === 5 },
    { label: "Coding", value: `${coding}/3`, ok: coding === 3 },
    { label: "Marks", value: `${marks}/20`, ok: marks === 20 },
    { label: "E / M / H", value: `${easy}/${med}/${hard}`, ok: easy >= 1 && med >= 1 && hard >= 1 },
  ];

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        valid
          ? "border-green/40 bg-gradient-to-br from-green/10 via-green/5 to-transparent"
          : "border-border/80 bg-bg3/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {valid ? (
            <CheckCircle2 className="h-4 w-4 text-green" />
          ) : (
            <AlertCircle className="h-4 w-4 text-gold" />
          )}
          <span
            className={`text-xs font-bold uppercase tracking-wider ${
              valid ? "text-green" : "text-foreground"
            }`}
          >
            {valid ? "Full Compliance (8/8)" : "Rule Validation"}
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">Target: 20 marks</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {items.map(({ label, value, ok }) => (
          <div
            key={label}
            className={`rounded-lg p-2 text-center text-xs border transition-all ${
              ok
                ? "border-green/40 bg-green/10 text-green font-bold"
                : "border-border/60 bg-bg3/80 text-muted-foreground"
            }`}
          >
            <span className="block font-mono text-xs font-extrabold">{value}</span>
            <span className="text-[10px] uppercase tracking-tight opacity-75">{label}</span>
          </div>
        ))}
      </div>

      {!valid && (
        <p className="mt-2.5 text-[11px] text-muted-foreground/90 leading-tight">
          Required: Exactly 5 MCQs (1 mark each) + 3 Coding (1 Easy, 1 Med, 1 Hard = 15 marks) for
          20 marks total.
        </p>
      )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-bg2 p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/10 text-cyan ring-1 ring-cyan/20">
              {form.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">
                {form.id ? "Edit Question" : "Create New Question"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {form.id ? "Updates question bank & active sets." : "Adds directly to active set."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-bg3 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Toggle & Difficulty */}
          <div className="flex flex-wrap gap-4 items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Type:</span>
              <div className="flex rounded-xl border border-border bg-bg3 p-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: "mcq", marks: 1 }))}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    isMcq
                      ? "bg-violet text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  MCQ (1 Mark)
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: "coding", marks: 5 }))}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    !isMcq
                      ? "bg-cyan text-black shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Coding (5 Marks)
                </button>
              </div>
            </div>

            {!isMcq ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Difficulty:</span>
                <select
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      difficulty: e.target.value as "easy" | "medium" | "hard",
                    }))
                  }
                  className="rounded-xl border border-border bg-bg3 px-3 py-1 text-xs font-bold text-foreground focus:border-cyan focus:outline-none"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Marks:</span>
              <input
                type="number"
                min="1"
                max="20"
                value={form.marks}
                onChange={(e) => setForm((f) => ({ ...f, marks: Number(e.target.value) }))}
                className="w-16 rounded-xl border border-border bg-bg3 px-2 py-1 text-xs text-center font-mono focus:border-cyan focus:outline-none"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              Question Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Reverse Linked List / Python Dictionary Lookup"
              className="h-10 w-full rounded-xl border border-border bg-bg3 px-3 text-sm focus:border-cyan focus:outline-none transition-colors"
            />
          </div>

          {/* Problem Body */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              Problem Description (Markdown supported)
            </label>
            <textarea
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Describe the problem, input format, constraints, and examples..."
              className="w-full rounded-xl border border-border bg-bg3 p-3 text-sm focus:border-cyan focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Image Attachment */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              Diagram / Flowchart Image Attachment (Optional)
            </label>
            {form.imageUrl ? (
              <div className="relative rounded-xl border border-border bg-bg3/60 p-2 flex items-center gap-3">
                <img
                  src={form.imageUrl}
                  alt="preview"
                  className="h-16 w-24 object-cover rounded-lg border border-border"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-green block">Image attached</span>
                  <span className="text-[11px] text-muted-foreground truncate block font-mono">
                    {form.imageUrl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                  className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  title="Remove image"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg3/40 p-4 cursor-pointer hover:border-cyan/50 hover:bg-bg3/80 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-xs font-medium text-muted-foreground">
                  {uploadingImage
                    ? "Uploading image..."
                    : "Upload diagram, flowchart, or problem image"}
                </span>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                  PNG, JPG, SVG, WebP up to 5MB
                </span>
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
                  className="w-full rounded-xl border border-border bg-bg3 p-3 font-mono text-sm focus:border-cyan focus:outline-none resize-none"
                />
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground">Correct Option:</span>
                <div className="flex gap-2">
                  {form.optionsText
                    .split("\n")
                    .map((opt) => opt.trim())
                    .filter(Boolean)
                    .map((_, idx) => (
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
            <div>
              <span className="text-xs font-bold text-muted-foreground mb-1 block">
                Test Cases (JSON format)
              </span>
              <textarea
                rows={4}
                value={form.testCasesText}
                onChange={(e) => setForm((f) => ({ ...f, testCasesText: e.target.value }))}
                placeholder='[{"input": "5\\n", "expected_output": "25\\n", "is_hidden": false}]'
                className="w-full rounded-xl border border-border bg-black/60 p-3 font-mono text-xs focus:border-cyan focus:outline-none resize-none"
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
            <Button
              type="submit"
              disabled={saving || uploadingImage}
              className="gap-2 font-bold shadow-glow"
            >
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-bg2 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase border ${tag.cls}`}
            >
              {tag.label}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{question.marks} marks</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
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

        <p className="mt-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-sans">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-bg2 p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-border/80 pb-3 mb-4 shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan" /> Question Bank Pool — Set {activeSet}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click "+ Add" to include in Set {activeSet}. Selected: {currentIds.length}/8
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
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
                  typeFilter === f
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-bg3"
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
                      inSet
                        ? "border-cyan bg-cyan text-black"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {inSet ? currentIds.indexOf(q.id) + 1 : ""}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border ${tag.cls}`}
                      >
                        {tag.label}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {q.marks}m
                      </span>
                      {q.image_url && <ImageIcon className="h-3 w-3 text-cyan/70" />}
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{q.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{q.body}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
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
                        inSet
                          ? "text-cyan border border-cyan/40 bg-cyan/10 hover:bg-cyan/20"
                          : "shadow-sm"
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
      return data as unknown as QuestionRow[];
    },
  });

  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"studio" | "list">("studio");
  const [contestFilter, setContestFilter] = useState<"all" | "draft" | "active" | "past">("all");
  const [contestSearch, setContestSearch] = useState("");

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [practice, setPractice] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  // Default selection to first draft or first contest if none selected
  useEffect(() => {
    if (!selectedContestId && contests.length > 0) {
      const draft = contests.find((c) => c.is_draft);
      setSelectedContestId(draft ? draft.id : contests[0]!.id);
    }
  }, [contests, selectedContestId]);

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

  const currentIds = setQuestions[activeSet];

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
    setShowCreateModal(false);
    setViewMode("studio");
    setMessage({
      type: "ok",
      text: "Draft contest created! You can now configure Sets A, B, and C.",
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
        : {
            type: "ok",
            text: `Set ${set} saved successfully (${setQuestions[set].length} questions).`,
          },
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

    const { error: saveAError } = await supabase.rpc("admin_set_contest_questions", {
      _contest_id: selectedContestId,
      _question_ids: setQuestions.A,
      _set_code: "A",
    });
    if (saveAError) {
      setAutoGenLoading(false);
      return setMessage({ type: "err", text: `Failed to save Set A: ${saveAError.message}` });
    }

    const { data, error } = await supabase.rpc("admin_auto_generate_sets", {
      _contest_id: selectedContestId,
    });
    if (error) {
      setAutoGenLoading(false);
      return setMessage({ type: "err", text: error.message });
    }

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
    setViewMode("studio");
    setMessage({
      type: "ok",
      text: "Contest cloned as a new draft! You can now adjust its dates or edit sets.",
    });
  }

  const selectedContest = contests.find((c) => c.id === selectedContestId);
  const setAValid = setQuestions.A.length === 8;
  const allSetsValid = (["A", "B", "C"] as SetCode[]).every((s) => setQuestions[s].length === 8);
  const qMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  // Contests filtering for table list
  const filteredContests = useMemo(() => {
    return contests.filter((c) => {
      const matchSearch =
        !contestSearch.trim() ||
        c.title.toLowerCase().includes(contestSearch.toLowerCase()) ||
        (c.description ?? "").toLowerCase().includes(contestSearch.toLowerCase());
      if (!matchSearch) return false;
      const st = contestStatus(c);
      if (contestFilter === "draft") return c.is_draft || st === "draft";
      if (contestFilter === "active") return st === "live" || st === "scheduled";
      if (contestFilter === "past") return st === "closed";
      return true;
    });
  }, [contests, contestSearch, contestFilter]);

  return (
    <div className="space-y-6">
      {/* ── Top Executive Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan/10 border border-cyan/30 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-cyan">
              <Sparkles className="h-3 w-3" />
              Nilgiri Contest Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Contests & Set Architecture
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Configure randomized question pools (Sets A · B · C), balance scoring rules, and
            publish.
          </p>
        </div>

        {/* View Mode Toggle & New Contest Button */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="inline-flex rounded-xl border border-border/80 bg-bg2 p-1 shadow-sm">
            <button
              onClick={() => setViewMode("studio")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                viewMode === "studio"
                  ? "bg-cyan text-black shadow-glow font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Set Studio
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                viewMode === "list"
                  ? "bg-bg3 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              All Contests ({contests.length})
            </button>
          </div>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="gap-2 font-bold h-9 px-4 shadow-glow"
          >
            <Plus className="h-4 w-4" />
            New Contest
          </Button>
        </div>
      </div>

      {/* ── Global Alert / Toast Message ── */}
      {message && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium shadow-sm transition-all ${
            message.type === "ok"
              ? "border-green/40 bg-green/10 text-green"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="rounded-lg p-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 1: SET STUDIO (Default & Focused Workspace)
          ───────────────────────────────────────────────────────────── */}
      {viewMode === "studio" && (
        <div className="space-y-5">
          {/* Executive Contest Selector & Control Strip */}
          <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-bg2 via-bg2/95 to-bg3/80 p-4 sm:p-5 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Contest Dropdown Selector */}
              <div className="flex-1 min-w-[280px]">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-cyan mb-1.5">
                  Select Contest to Configure
                </label>
                <div className="relative">
                  <select
                    value={selectedContestId ?? ""}
                    onChange={(e) => setSelectedContestId(e.target.value || null)}
                    className="w-full h-11 appearance-none rounded-xl border border-cyan/40 bg-bg3/90 px-4 pr-10 text-sm font-bold text-foreground focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan shadow-inner cursor-pointer transition-colors"
                  >
                    {contests.length === 0 ? (
                      <option value="">No contests available (Create one)</option>
                    ) : (
                      contests.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} — {c.is_draft ? "[Draft]" : "[Published]"} ({c.duration_minutes}
                          m)
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan" />
                </div>
              </div>

              {/* Contest Metadata & Quick Actions */}
              {selectedContest && (
                <div className="flex flex-wrap items-center gap-3 pt-2 lg:pt-0">
                  <div className="flex items-center gap-2">
                    <StatusPill status={contestStatus(selectedContest)} />
                    {selectedContest.is_practice && (
                      <span className="rounded-lg bg-gold/15 border border-gold/30 px-2 py-0.5 text-[10px] font-bold text-gold">
                        PRACTICE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-bg3/80 border border-border/60 rounded-xl px-3 py-1.5">
                    <Clock className="h-3.5 w-3.5 text-cyan" />
                    <span>{selectedContest.duration_minutes} mins</span>
                    <span className="text-border">|</span>
                    <span className="truncate">{formatIST(selectedContest.start_time)}</span>
                  </div>

                  {/* Actions: Monitor, Clone, View Contests */}
                  <div className="flex items-center gap-1.5">
                    <Link
                      to="/admin/contests/$id/monitor"
                      params={{ id: selectedContest.id }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-bg3 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-cyan hover:border-cyan/40 transition-colors shadow-sm"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Live Monitor
                    </Link>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void clone(selectedContest.id)}
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      title="Clone as new draft"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Clone
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Workflow Stepper */}
            {selectedContest && (
              <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* Step 1 */}
                <div
                  className={`flex items-center gap-3 rounded-xl p-3 border transition-colors ${
                    setAValid ? "border-green/40 bg-green/5" : "border-cyan/40 bg-cyan/5"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono font-bold ${
                      setAValid ? "bg-green text-black" : "bg-cyan text-black"
                    }`}
                  >
                    1
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      Set A Master: {setQuestions.A.length}/8
                    </p>
                    <p className="text-[10px] text-muted-foreground">5 MCQs + 3 Coding</p>
                  </div>
                  {setAValid && <CheckCircle2 className="h-4 w-4 text-green ml-auto shrink-0" />}
                </div>

                {/* Step 2 */}
                <div
                  className={`flex items-center gap-3 rounded-xl p-3 border transition-colors ${
                    setQuestions.B.length === 8 && setQuestions.C.length === 8
                      ? "border-green/40 bg-green/5"
                      : "border-border/60 bg-bg3/40"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono font-bold ${
                      setQuestions.B.length === 8 && setQuestions.C.length === 8
                        ? "bg-green text-black"
                        : "bg-bg3 border border-border text-muted-foreground"
                    }`}
                  >
                    2
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">Sets B & C Permutations</p>
                    <p className="text-[10px] text-muted-foreground">
                      B: {setQuestions.B.length}/8 · C: {setQuestions.C.length}/8
                    </p>
                  </div>
                  {setQuestions.B.length === 8 && setQuestions.C.length === 8 && (
                    <CheckCircle2 className="h-4 w-4 text-green ml-auto shrink-0" />
                  )}
                </div>

                {/* Step 3 */}
                <div
                  className={`flex items-center gap-3 rounded-xl p-3 border transition-colors ${
                    allSetsValid ? "border-green/40 bg-green/5" : "border-border/60 bg-bg3/40"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono font-bold ${
                      allSetsValid
                        ? "bg-green text-black"
                        : "bg-bg3 border border-border text-muted-foreground"
                    }`}
                  >
                    3
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {allSetsValid ? "Ready to Launch!" : "Publish & Lock"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Deterministic assignment</p>
                  </div>
                  {allSetsValid && <CheckCircle2 className="h-4 w-4 text-green ml-auto shrink-0" />}
                </div>
              </div>
            )}
          </div>

          {/* If no contest exists */}
          {!selectedContest && (
            <div className="rounded-2xl border border-dashed border-border bg-bg2 p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan/10 text-cyan">
                <Layers className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-foreground">No Contest Selected</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Create a new contest draft to start building your questions and sets.
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 gap-2 font-bold shadow-glow"
              >
                <Plus className="h-4 w-4" /> Create First Contest
              </Button>
            </div>
          )}

          {/* Main 2-Column Set Studio Workspace */}
          {selectedContest && (
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              {/* Left Column: Set Questions Canvas */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/80 bg-bg2 overflow-hidden shadow-sm">
                  {/* Set Selection Bar & Actions */}
                  <div className="flex flex-wrap items-center justify-between border-b border-border/80 px-5 py-3.5 bg-bg3/40 gap-3">
                    {/* Set Tabs */}
                    <div className="flex items-center gap-1.5">
                      {(["A", "B", "C"] as SetCode[]).map((s) => {
                        const theme = SET_THEME[s];
                        const isCurrent = activeSet === s;
                        const count = setQuestions[s].length;
                        return (
                          <button
                            key={s}
                            onClick={() => setActiveSet(s)}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                              isCurrent
                                ? `${theme.activeTab} ${theme.glow}`
                                : "text-muted-foreground hover:text-foreground hover:bg-bg3"
                            }`}
                          >
                            <span>Set {s}</span>
                            <span
                              className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-extrabold ${
                                isCurrent
                                  ? "bg-black/20 text-current"
                                  : "bg-bg3 text-muted-foreground"
                              }`}
                            >
                              {count}/8
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Set Tools */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activeSet !== "A" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={copyFromSetA}
                            className="h-8 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground hover:bg-bg3"
                            title="Copy Set A questions into this set"
                          >
                            <Copy className="h-3 w-3" /> Copy A
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={shuffleFromSetA}
                            className="h-8 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground hover:bg-bg3"
                            title="Shuffle Set A questions into this set"
                          >
                            <Shuffle className="h-3 w-3" /> Shuffle A
                          </Button>
                        </>
                      )}

                      <Button
                        size="sm"
                        onClick={() => autoFillSet(activeSet)}
                        className="h-8 gap-1.5 text-xs font-bold bg-cyan/10 text-cyan border border-cyan/30 hover:bg-cyan/20"
                        title="Auto-fill 5 MCQs + 3 Coding questions"
                      >
                        <Wand2 className="h-3.5 w-3.5" /> Auto-Fill (5+3)
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => setShowPickerModal(true)}
                        className="h-8 gap-1.5 text-xs font-bold bg-cyan text-black hover:bg-cyan/90 shadow-sm"
                      >
                        <Plus className="h-3.5 w-3.5" /> From Bank
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditorDraft(emptyDraft)}
                        className="h-8 gap-1.5 text-xs font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" /> New Question
                      </Button>
                    </div>
                  </div>

                  {/* Subhead status */}
                  <div className="flex items-center justify-between px-5 py-2.5 bg-bg3/20 border-b border-border/40 text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Set <strong className="text-foreground">{activeSet}</strong>:{" "}
                      <span className="font-mono text-cyan">{currentIds.length} / 8</span> questions
                    </span>
                    <span className="text-[11px] text-muted-foreground/75 font-mono">
                      Drag / arrow keys adjust presentation order
                    </span>
                  </div>

                  {/* Question Cards Feed */}
                  <div className="p-4 space-y-2.5">
                    {currentIds.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/80 p-10 text-center text-muted-foreground text-xs leading-relaxed bg-bg3/20">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                          <Layers className="h-5 w-5" />
                        </div>
                        <p className="font-bold text-foreground text-sm">
                          Set {activeSet} is currently empty
                        </p>
                        <p className="mt-1 text-muted-foreground max-w-sm mx-auto">
                          Add 5 MCQs and 3 Coding questions from your question bank, or click
                          Auto-Fill.
                        </p>
                        <div className="mt-4 flex justify-center gap-2.5">
                          <Button
                            size="sm"
                            onClick={() => setShowPickerModal(true)}
                            className="gap-1.5 text-xs font-bold"
                          >
                            <Plus className="h-3.5 w-3.5" /> Browse Question Bank
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => autoFillSet(activeSet)}
                            className="gap-1.5 text-xs font-bold"
                          >
                            <Wand2 className="h-3.5 w-3.5 text-cyan" /> Instant Auto-Fill (5+3)
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
                            className="group flex items-center gap-3.5 rounded-xl border border-border/80 bg-bg3/50 p-3 hover:border-cyan/40 hover:bg-bg3/80 transition-all shadow-sm"
                          >
                            {/* Reorder Arrows */}
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                type="button"
                                className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-bg3 disabled:opacity-20 transition-colors"
                                onClick={() => moveQuestion(id, "up")}
                                disabled={index === 0}
                                title="Move up"
                              >
                                <ChevronUp className="h-3.5 w-3.5 mx-auto" />
                              </button>
                              <button
                                type="button"
                                className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-bg3 disabled:opacity-20 transition-colors"
                                onClick={() => moveQuestion(id, "down")}
                                disabled={index === currentIds.length - 1}
                                title="Move down"
                              >
                                <ChevronDown className="h-3.5 w-3.5 mx-auto" />
                              </button>
                            </div>

                            {/* Position Badge */}
                            <div className="h-7 w-7 shrink-0 rounded-lg bg-bg2 border border-border font-mono text-xs font-extrabold flex items-center justify-center text-foreground shadow-inner">
                              #{index + 1}
                            </div>

                            {/* Thumbnail or Type Icon */}
                            {q.image_url ? (
                              <div
                                onClick={() => setPreviewQuestion(q)}
                                className="h-10 w-10 shrink-0 rounded-lg border border-border bg-black/60 overflow-hidden cursor-pointer flex items-center justify-center hover:border-cyan transition-colors"
                                title="Click to view full image"
                              >
                                <img
                                  src={q.image_url}
                                  alt="attachment"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-lg border border-border/60 bg-bg2 flex items-center justify-center text-muted-foreground text-xs font-mono font-bold">
                                {q.type === "mcq" ? "MCQ" : "</>"}
                              </div>
                            )}

                            {/* Question Title & Meta */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span
                                  className={`rounded-md px-1.5 py-0.2 text-[10px] font-bold uppercase border ${tag.cls}`}
                                >
                                  {tag.label}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {q.marks} mark{q.marks === 1 ? "" : "s"}
                                </span>
                                {q.image_url && (
                                  <span className="flex items-center gap-1 text-[10px] font-mono text-cyan bg-cyan/10 px-1.5 py-0.2 rounded border border-cyan/20">
                                    <ImageIcon className="h-2.5 w-2.5" /> Image
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-foreground line-clamp-1">
                                {q.title}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{q.body}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => setPreviewQuestion(q)}
                                title="Preview as student"
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
                                    optionsText: Array.isArray(q.options)
                                      ? q.options.join("\n")
                                      : "",
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
                                title="Edit question details"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeQuestion(q.id)}
                                title="Remove from Set"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Save Current Set Dock */}
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-bg2 px-5 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Set {activeSet} Configuration
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {currentIds.length} of 8 assigned questions
                    </p>
                  </div>
                  <Button
                    onClick={() => void saveSet(activeSet)}
                    disabled={savingSet}
                    className="gap-2 font-bold h-9 shadow-glow"
                  >
                    <ListChecks className="h-4 w-4" />
                    {savingSet ? "Saving..." : `Save Set ${activeSet}`}
                  </Button>
                </div>
              </div>

              {/* Right Column: Governance, Shuffling & Publishing */}
              <div className="space-y-4">
                {/* Real-time Validation Card */}
                <div className="rounded-2xl border border-border/80 bg-bg2 overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-bg3/30">
                    <Shield className="h-4 w-4 text-cyan" />
                    <h3 className="font-bold text-sm">Set {activeSet} Governance</h3>
                  </div>
                  <div className="p-4">
                    <CompositionStatus ids={currentIds} questions={questions} />
                  </div>
                </div>

                {/* All Sets Quick Progress Card */}
                <div className="rounded-2xl border border-border/80 bg-bg2 overflow-hidden shadow-sm">
                  <div className="px-5 py-3.5 border-b border-border bg-bg3/30 flex items-center justify-between">
                    <h3 className="font-bold text-sm">All 3 Sets Status</h3>
                    <span className="text-xs font-mono text-muted-foreground">
                      Deterministic Pool
                    </span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {(["A", "B", "C"] as SetCode[]).map((s) => {
                      const count = setQuestions[s].length;
                      const isComplete = count === 8;
                      const isCurr = activeSet === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setActiveSet(s)}
                          className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
                            isCurr
                              ? `${SET_THEME[s].bg} border-l-[3px] ${SET_THEME[s].border}`
                              : "border-l-[3px] border-l-transparent hover:bg-bg3/40"
                          }`}
                        >
                          <div>
                            <span className="font-bold text-sm text-foreground block">Set {s}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {s === "A" ? "Core master" : "Permuted variant"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-foreground">
                              {count}/8
                            </span>
                            {isComplete ? (
                              <CheckCircle2 className="h-4 w-4 text-green" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground/60" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auto-Gen B & C Card */}
                <div className="rounded-2xl border border-violet/30 bg-gradient-to-br from-violet/10 via-violet/5 to-transparent p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="h-4 w-4 text-violet" />
                    <h3 className="font-bold text-sm text-violet">Auto-Generate Sets B & C</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Uses Set A as the master pool to generate distinct randomized permutations for
                    Sets B and C while maintaining identical difficulty balance.
                  </p>
                  <Button
                    onClick={() => void autoGenerate()}
                    disabled={!setAValid || autoGenLoading}
                    className="w-full gap-2 font-bold bg-violet hover:bg-violet/90 text-white disabled:opacity-40"
                  >
                    <Shuffle className="h-4 w-4" />
                    {autoGenLoading ? "Shuffling & Storing..." : "Auto-Gen Sets B & C"}
                  </Button>
                  {!setAValid && (
                    <p className="mt-2 text-center text-[11px] text-muted-foreground font-mono">
                      Complete Set A (8 questions) first.
                    </p>
                  )}
                </div>

                {/* Publish Contest Card */}
                <div
                  className={`rounded-2xl border p-5 shadow-sm transition-all ${
                    allSetsValid
                      ? "border-green/40 bg-gradient-to-br from-green/10 via-green/5 to-transparent shadow-[0_0_25px_-5px_rgba(16,185,129,0.25)]"
                      : "border-border/80 bg-bg2"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Send
                      className={`h-4 w-4 ${allSetsValid ? "text-green" : "text-muted-foreground"}`}
                    />
                    <h3
                      className={`font-bold text-sm ${allSetsValid ? "text-green" : "text-foreground"}`}
                    >
                      Contest Publication
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Once published, Sets A, B, and C are permanently locked. Candidates are
                    deterministically mapped to a set on their first attempt.
                  </p>
                  <Button
                    onClick={() => void publish()}
                    disabled={!allSetsValid || publishing}
                    className={`w-full gap-2 font-bold transition-all ${
                      allSetsValid
                        ? "bg-green hover:bg-green/80 text-black shadow-glow font-extrabold"
                        : "bg-bg3 text-muted-foreground border border-border cursor-not-allowed"
                    }`}
                  >
                    <Send className="h-4 w-4" />
                    {publishing ? "Publishing..." : "Publish & Lock Sets"}
                  </Button>
                  {!allSetsValid && (
                    <p className="mt-2 text-center text-[11px] text-muted-foreground font-mono">
                      All sets (A, B, C) must have exactly 8 questions.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 2: ALL CONTESTS (Data Table Directory)
          ───────────────────────────────────────────────────────────── */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {/* Table Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-bg2 p-4">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={contestSearch}
                onChange={(e) => setContestSearch(e.target.value)}
                placeholder="Search contests by title or description..."
                className="h-10 w-full rounded-xl border border-border bg-bg3 pl-10 pr-4 text-sm focus:border-cyan focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              {(["all", "draft", "active", "past"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setContestFilter(filter)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    contestFilter === filter
                      ? "bg-cyan text-black shadow-sm"
                      : "text-muted-foreground hover:bg-bg3 hover:text-foreground"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Contests Table */}
          <div className="rounded-2xl border border-border bg-bg2 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border bg-bg3/40 px-6 py-3.5">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                Contest
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground w-24 text-center">
                Status
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground w-36 text-center">
                Set Studio
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground w-32 text-right">
                Actions
              </span>
            </div>

            {filteredContests.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No contests found. Click "New Contest" to create one.
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredContests.map((c) => {
                  const isSelected = selectedContestId === c.id;
                  const status = contestStatus(c);
                  return (
                    <div
                      key={c.id}
                      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4 transition-all ${
                        isSelected
                          ? "bg-cyan/5 border-l-[3px] border-l-cyan"
                          : "border-l-[3px] border-l-transparent hover:bg-bg3/30"
                      }`}
                    >
                      {/* Title & Schedule */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{c.title}</span>
                          {c.is_practice && (
                            <span className="text-[10px] rounded-full bg-gold/15 text-gold px-2 py-0.5 font-bold border border-gold/20">
                              PRACTICE
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-[10px] rounded-full bg-cyan/15 text-cyan px-2 py-0.5 font-extrabold border border-cyan/30">
                              ACTIVE IN STUDIO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-2">
                          <span>
                            {formatIST(c.start_time)} → {formatIST(c.end_time)}
                          </span>
                          <span className="text-border">|</span>
                          <span className="text-[11px] bg-bg3 rounded px-1.5 py-0.2">
                            {c.duration_minutes}m
                          </span>
                        </p>
                      </div>

                      {/* Status */}
                      <div className="w-24 flex justify-center">
                        <StatusPill status={status} />
                      </div>

                      {/* Studio Action */}
                      <div className="w-36 flex justify-center">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedContestId(c.id);
                            setViewMode("studio");
                          }}
                          className="h-8 gap-1.5 text-xs font-bold bg-cyan text-black hover:bg-cyan/90 shadow-sm w-full justify-center"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Open Studio
                        </Button>
                      </div>

                      {/* Other Actions */}
                      <div className="w-32 flex items-center justify-end gap-1.5">
                        <Link
                          to="/admin/contests/$id/monitor"
                          params={{ id: c.id }}
                          className="h-8 px-3 inline-flex items-center rounded-lg text-xs font-semibold text-muted-foreground hover:text-cyan hover:bg-cyan/10 transition-colors"
                        >
                          Monitor
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => void clone(c.id)}
                          title="Clone contest"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Contest Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg2 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/10 text-cyan ring-1 ring-cyan/20">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Create Contest Draft</h2>
                  <p className="text-xs text-muted-foreground">
                    Draft details can be edited before publishing.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Contest Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Nilgiri Grand Challenge 2026"
                  className="h-10 w-full rounded-xl border border-border bg-bg3 px-3 text-sm focus:border-cyan focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Description / Guidelines
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional rules and announcements..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-bg3 p-3 text-sm focus:border-cyan focus:outline-none resize-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Start Time (IST)
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-bg3 px-3 text-xs text-foreground focus:border-cyan focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    End Time (IST)
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-bg3 px-3 text-xs text-foreground focus:border-cyan focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <span>Duration (mins):</span>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="h-9 w-20 rounded-xl border border-border bg-bg3 px-2 text-center text-xs font-mono focus:border-cyan focus:outline-none"
                  />
                </label>

                <label
                  className="flex cursor-pointer items-center gap-2.5 text-xs font-bold select-none"
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
                  <span className={practice ? "text-cyan" : "text-muted-foreground"}>
                    Practice Mode
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void createDraft()} className="gap-2 font-bold shadow-glow">
                  <Plus className="h-4 w-4" /> Create Draft
                </Button>
              </div>
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
        <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />
      )}
    </div>
  );
}
