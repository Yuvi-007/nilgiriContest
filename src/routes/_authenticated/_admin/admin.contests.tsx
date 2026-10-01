import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
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
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, PageHeader, StatusPill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { contestsQuery } from "@/lib/queries";
import { contestStatus, formatIST } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_admin/admin/contests")({
  head: () => ({ meta: [{ title: "Contests — nilgiriContest admin" }] }),
  component: AdminContests,
});

type QuestionMeta = {
  id: string;
  title: string;
  type: "mcq" | "coding";
  difficulty: "easy" | "medium" | "hard" | null;
  marks: number;
  image_url?: string | null;
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

function diffTag(q: QuestionMeta) {
  if (q.type === "mcq") return { label: "MCQ", cls: "bg-violet/15 text-violet" };
  const clsMap = {
    easy: "bg-green/15 text-green",
    medium: "bg-gold/15 text-gold",
    hard: "bg-orange/15 text-orange",
  } as const;
  return { label: q.difficulty ?? "coding", cls: clsMap[q.difficulty ?? "easy"] };
}

function CompositionStatus({ ids, questions }: { ids: string[]; questions: QuestionMeta[] }) {
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
          {valid ? "Ready to publish (Set composition valid)" : "Composition check"}
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

function SelectedQuestionsList({
  ids,
  questions,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  ids: string[];
  questions: QuestionMeta[];
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const qMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  if (ids.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-muted-foreground text-xs leading-relaxed">
        <p className="font-semibold text-foreground text-sm">No questions in this set yet.</p>
        <p className="mt-1">
          Click <strong>"Browse Question Bank"</strong> below or use <strong>"Auto-Fill Valid Set"</strong> to populate this set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ids.map((id, index) => {
        const q = qMap.get(id);
        if (!q) return null;
        const tag = diffTag(q);
        return (
          <div
            key={id}
            className="flex items-center gap-3 rounded-xl border border-cyan/40 bg-cyan/5 p-3 transition-colors"
          >
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                type="button"
                className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-bg3 disabled:opacity-20 transition-colors"
                onClick={() => onMoveUp(id)}
                disabled={index === 0}
                title="Move up"
              >
                <ChevronUp className="h-3.5 w-3.5 mx-auto" />
              </button>
              <button
                type="button"
                className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-bg3 disabled:opacity-20 transition-colors"
                onClick={() => onMoveDown(id)}
                disabled={index === ids.length - 1}
                title="Move down"
              >
                <ChevronDown className="h-3.5 w-3.5 mx-auto" />
              </button>
            </div>
            <div className="h-6 w-6 shrink-0 rounded-lg bg-cyan text-black flex items-center justify-center text-xs font-bold font-mono">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${tag.cls}`}>
                  {tag.label}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">{q.marks}m</span>
                {q.image_url && <ImageIcon className="h-3 w-3 text-cyan/60" />}
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-1">{q.title}</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(id)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              title="Remove question from this set"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function QuestionPickerRow({
  q,
  isSelected,
  position,
  onToggle,
}: {
  q: QuestionMeta;
  isSelected: boolean;
  position?: number | undefined;
  onToggle: () => void;
}) {
  const tag = diffTag(q);
  return (
    <div
      onClick={onToggle}
      className={`group flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-cyan/50 bg-cyan/5 shadow-sm"
          : "border-border bg-bg3/50 hover:border-border/80 hover:bg-bg3"
      }`}
    >
      <div
        className={`h-6 w-6 shrink-0 rounded-lg border-2 flex items-center justify-center text-xs font-bold font-mono transition-all ${
          isSelected ? "border-cyan bg-cyan text-black" : "border-border"
        }`}
      >
        {isSelected ? (position ?? "✓") : ""}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${tag.cls}`}>
            {tag.label}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">{q.marks}m</span>
          {q.image_url && <ImageIcon className="h-3 w-3 text-cyan/60" />}
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-1">{q.title}</p>
      </div>
      <div
        className={`shrink-0 text-xs font-semibold px-2 py-1 rounded transition-colors ${
          isSelected
            ? "text-cyan bg-cyan/10"
            : "text-muted-foreground group-hover:text-foreground bg-bg3"
        }`}
      >
        {isSelected ? "Remove" : "+ Add"}
      </div>
    </div>
  );
}

function AdminContests() {
  const queryClient = useQueryClient();
  const { data: contests = [] } = useQuery(contestsQuery);
  const { data: questions = [] } = useQuery<QuestionMeta[]>({
    queryKey: ["admin-builder-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id,title,type,difficulty,marks,image_url")
        .order("type")
        .order("marks");
      if (error) throw error;
      return (data as unknown) as QuestionMeta[];
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

  const [activeSet, setActiveSet] = useState<SetCode>("A");
  const [builderTab, setBuilderTab] = useState<"assigned" | "browse">("assigned");
  const [setQuestions, setSetQuestions] = useState<Record<SetCode, string[]>>({
    A: [],
    B: [],
    C: [],
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "mcq" | "coding">("all");
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const currentIds = setQuestions[activeSet];

  const filteredQuestions = useMemo(() => {
    const q = search.toLowerCase().trim();
    return questions.filter((item) => {
      const textMatch = !q || item.title.toLowerCase().includes(q);
      const typeMatch = typeFilter === "all" || item.type === typeFilter;
      return textMatch && typeMatch;
    });
  }, [questions, search, typeFilter]);

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
          text: `Set ${activeSet} already has 8 questions. Remove a question first before adding another.`,
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
    setBuilderTab("assigned");
    setMessage({
      type: "ok",
      text: `Set ${set} auto-filled with valid 5 MCQs + 3 Coding (Easy, Med, Hard)! Now save or auto-generate.`,
    });
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

  return (
    <>
      <PageHeader
        title="Contests"
        subtitle="Build question sets A · B · C, validate composition, then publish."
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

      {/* Contest list */}
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

      {/* When no contest is selected, show callout guide */}
      {!selectedContestId && (
        <GlassCard className="p-8 text-center border-dashed border-cyan/30">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan/10 text-cyan mb-3">
            <Layers className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">How to Assign Sets</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            1. Click <strong className="text-cyan">"Assign Sets (A/B/C)"</strong> on any draft contest above (or click <strong className="text-foreground">+ New contest</strong> to start fresh).
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            2. In the Question Builder that appears, pick 8 questions for Set A, click "Auto-Generate Sets B & C", then Publish!
          </p>
        </GlassCard>
      )}

      {/* Question Builder */}
      {selectedContestId && selectedContest && (
        <div className="space-y-6">
          {/* Workflow Stepper Banner */}
          <div className="rounded-2xl border border-cyan/30 bg-gradient-to-r from-cyan/10 via-bg2 to-violet/10 p-5 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan animate-ping" />
                  <h2 className="text-lg font-extrabold text-foreground">
                    Assigning Sets: "{selectedContest.title}"
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure Set A with 8 questions (5 MCQ + 3 Coding), then auto-generate shuffled Sets B & C.
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

            {/* Visual step badges */}
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
                  <p className="text-[10px] opacity-80">Click "Auto-Gen Sets B & C"</p>
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
                    {allSetsValid ? "Ready to publish!" : "All sets must pass composition"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Builder Layout */}
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            {/* Left: question editor */}
            <div className="space-y-4">
              <GlassCard className="p-0 overflow-hidden">
                {/* Set tabs */}
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
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all border ${
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

                  {/* Tab: Assigned vs Browse Bank */}
                  <div className="flex items-center rounded-lg border border-border bg-bg3 p-0.5">
                    <button
                      type="button"
                      onClick={() => setBuilderTab("assigned")}
                      className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                        builderTab === "assigned"
                          ? "bg-cyan text-black"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Assigned ({currentIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuilderTab("browse")}
                      className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                        builderTab === "browse"
                          ? "bg-cyan text-black"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Browse Bank ({questions.length})
                    </button>
                  </div>
                </div>

                {builderTab === "assigned" ? (
                  /* Assigned Questions View */
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          Questions in Set {activeSet} ({currentIds.length}/8)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Order here is the order students will see. Use arrows to reorder.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => autoFillSet(activeSet)}
                        className="h-8 gap-1.5 text-xs font-bold"
                      >
                        <Wand2 className="h-3 w-3 text-cyan" /> Auto-Fill
                      </Button>
                    </div>

                    <SelectedQuestionsList
                      ids={currentIds}
                      questions={questions}
                      onRemove={removeQuestion}
                      onMoveUp={(id) => moveQuestion(id, "up")}
                      onMoveDown={(id) => moveQuestion(id, "down")}
                    />

                    {currentIds.length < 8 && (
                      <div className="mt-4 pt-4 border-t border-border/50 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBuilderTab("browse")}
                          className="gap-2 border-cyan/40 text-cyan hover:bg-cyan/10"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Browse &amp; Add Questions from Question Bank
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Browse Bank View */
                  <div>
                    {/* Search + filter */}
                    <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3 bg-bg3/20">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search questions by title..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="h-9 w-full rounded-xl border border-border bg-bg3 pl-10 pr-4 text-sm focus:border-cyan focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-1">
                        {(["all", "mcq", "coding"] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setTypeFilter(f)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors capitalize ${
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

                    {/* Question list */}
                    <div className="max-h-[500px] overflow-y-auto p-4 space-y-2">
                      {filteredQuestions.length === 0 ? (
                        <p className="text-center py-8 text-sm text-muted-foreground">
                          No questions match your filter.
                        </p>
                      ) : (
                        filteredQuestions.map((q) => {
                          const isSelected = currentIds.includes(q.id);
                          const position = isSelected
                            ? currentIds.indexOf(q.id) + 1
                            : undefined;
                          return (
                            <QuestionPickerRow
                              key={q.id}
                              q={q}
                              isSelected={isSelected}
                              position={position}
                              onToggle={() => toggleQuestion(q.id)}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Save set button */}
              <div className="flex items-center justify-between gap-3 p-2">
                <Button
                  onClick={() => void saveSet(activeSet)}
                  disabled={savingSet}
                  variant="secondary"
                  className="gap-2 font-bold"
                >
                  <ListChecks className="h-4 w-4 text-cyan" />
                  {savingSet ? "Saving..." : `Save Set ${activeSet} (${currentIds.length}/8)`}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Changes save to database per set.
                </span>
              </div>
            </div>

            {/* Right: composition + actions */}
            <div className="space-y-4">
              <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-cyan" />
                  <h3 className="font-bold text-sm">Set {activeSet} — Composition Check</h3>
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
                          {s === "A" ? "Base configuration" : "Shuffled permutation"}
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
                  <h3 className="font-bold text-sm text-violet">Auto-generate Sets B & C</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Once Set A has 8 questions, auto-generate two randomized permutations (B & C).
                  Every student will receive a different set!
                </p>
                <Button
                  onClick={() => void autoGenerate()}
                  disabled={!setAValid || autoGenLoading}
                  className="w-full gap-2 font-bold bg-violet hover:bg-violet/80 text-white"
                >
                  <Shuffle className="h-4 w-4" />
                  {autoGenLoading ? "Generating..." : "Auto-generate Sets B & C"}
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
                  Locking publishes the contest. Students can now participate when live.
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
    </>
  );
}
