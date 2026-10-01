import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
  const clsMap = { easy: "bg-green/15 text-green", medium: "bg-gold/15 text-gold", hard: "bg-orange/15 text-orange" } as const;
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
  const valid = sel.length === 8 && mcq === 5 && coding === 3 && marks === 20 && easy >= 1 && med >= 1 && hard >= 1;

  const items = [
    { label: "Total", value: `${sel.length}/8`, ok: sel.length === 8 },
    { label: "MCQs", value: `${mcq}/5`, ok: mcq === 5 },
    { label: "Coding", value: `${coding}/3`, ok: coding === 3 },
    { label: "Marks", value: `${marks}/20`, ok: marks === 20 },
    { label: "E/M/H", value: `${easy}/${med}/${hard}`, ok: easy >= 1 && med >= 1 && hard >= 1 },
  ];

  return (
    <div className={`rounded-xl border p-4 transition-colors ${valid ? "border-green/40 bg-green/5" : "border-border bg-bg3/60"}`}>
      <div className="flex items-center gap-2 mb-3">
        {valid ? (
          <CheckCircle2 className="h-4 w-4 text-green" />
        ) : (
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className={`text-xs font-bold uppercase tracking-wider ${valid ? "text-green" : "text-muted-foreground"}`}>
          {valid ? "Ready to publish" : "Composition check"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {items.map(({ label, value, ok }) => (
          <div key={label} className={`rounded-lg p-2 text-center text-xs border ${ok ? "border-green/30 bg-green/10 text-green" : "border-border bg-bg3 text-muted-foreground"}`}>
            <span className="block font-mono font-bold text-sm">{value}</span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionPickerRow({
  q,
  isSelected,
  position,
  onToggle,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  q: QuestionMeta;
  isSelected: boolean;
  position?: number | undefined;
  onToggle: () => void;
  onMoveUp?: (() => void) | undefined;
  onMoveDown?: (() => void) | undefined;
  isFirst?: boolean | undefined;
  isLast?: boolean | undefined;
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
      {isSelected && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-bg3 disabled:opacity-20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            disabled={isFirst}
            title="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5 mx-auto" />
          </button>
          <button
            className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-bg3 disabled:opacity-20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            disabled={isLast}
            title="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5 mx-auto" />
          </button>
        </div>
      )}
      <div className={`h-6 w-6 shrink-0 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all ${
        isSelected ? "border-cyan bg-cyan text-black" : "border-border"
      }`}>
        {isSelected ? (position ?? "") : ""}
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
      <div className={`shrink-0 transition-colors ${isSelected ? "text-cyan" : "text-transparent group-hover:text-muted-foreground"}`}>
        {isSelected ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
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
  const [setQuestions, setSetQuestions] = useState<Record<SetCode, string[]>>({ A: [], B: [], C: [] });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "mcq" | "coding">("all");
  const [autoGenLoading, setAutoGenLoading] = useState(false);

  const currentIds = setQuestions[activeSet];

  const filteredQuestions = useMemo(() => {
    const q = search.toLowerCase().trim();
    return questions.filter((item) => {
      const textMatch = !q || item.title.toLowerCase().includes(q);
      const typeMatch = typeFilter === "all" || item.type === typeFilter;
      return textMatch && typeMatch;
    });
  }, [questions, search, typeFilter]);

  useEffect(() => {
    if (!selectedContestId) {
      setSetQuestions({ A: [], B: [], C: [] });
      return;
    }
    void (async () => {
      const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      const { data } = await rpc("admin_get_contest_questions", { _contest_id: selectedContestId });
      const rows = (data as Array<{ set_code: string; question_id: string; position: number }> | null) ?? [];
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
      return { ...prev, [activeSet]: [...cur, id] };
    });
  }

  function moveQuestion(id: string, dir: "up" | "down") {
    setSetQuestions((prev) => {
      const cur = [...prev[activeSet]];
      const idx = cur.indexOf(id);
      if (idx < 0) return prev;
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= cur.length) return prev;
      const tmp = cur[idx]!; cur[idx] = cur[swapIdx]!; cur[swapIdx] = tmp;
      return { ...prev, [activeSet]: cur };
    });
  }

  async function createDraft() {
    setMessage(null);
    if (!title || !startTime || !endTime) return setMessage({ type: "err", text: "Title, start time, and end time are required." });
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
    setTitle(""); setDescription(""); setShowCreateForm(false);
    setMessage({ type: "ok", text: "Draft created. Now assign questions to Set A, then auto-generate Sets B & C." });
  }

  async function saveSet(set: SetCode) {
    if (!selectedContestId) return;
    setMessage(null);
    const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    const { error } = await rpc("admin_set_contest_questions", {
      _contest_id: selectedContestId,
      _question_ids: setQuestions[set],
      _set_code: set,
    });
    setMessage(error
      ? { type: "err", text: (error as { message?: string }).message ?? String(error) }
      : { type: "ok", text: `Set ${set} saved (${setQuestions[set].length} questions).` }
    );
  }

  async function autoGenerate() {
    if (!selectedContestId) return;
    setAutoGenLoading(true);
    setMessage(null);
    const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    const { data, error } = await rpc("admin_auto_generate_sets", { _contest_id: selectedContestId });
    setAutoGenLoading(false);
    if (error) return setMessage({ type: "err", text: (error as { message?: string }).message ?? String(error) });
    setMessage({ type: "ok", text: (data as { message?: string })?.message ?? "Sets B & C generated!" });
    const { data: rows2 } = await rpc("admin_get_contest_questions", { _contest_id: selectedContestId });
    const rows = (rows2 as Array<{ set_code: string; question_id: string; position: number }> | null) ?? [];
    const result: Record<SetCode, string[]> = { A: [], B: [], C: [] };
    for (const sc of ["A", "B", "C"] as SetCode[]) {
      result[sc] = rows.filter((r) => r.set_code === sc).sort((a, b) => a.position - b.position).map((r) => r.question_id);
    }
    setSetQuestions(result);
  }

  async function publish() {
    if (!selectedContestId) return;
    setMessage(null);
    const { error } = await supabase.rpc("admin_publish_contest", { _contest_id: selectedContestId });
    if (error) return setMessage({ type: "err", text: error.message });
    await queryClient.invalidateQueries({ queryKey: ["contests"] });
    setMessage({ type: "ok", text: "Contest published and locked. Students can now enter!" });
  }

  async function clone(contestId: string) {
    const { data, error } = await supabase.rpc("admin_clone_contest", { _source_id: contestId });
    if (error) return setMessage({ type: "err", text: error.message });
    await queryClient.invalidateQueries({ queryKey: ["contests"] });
    setSelectedContestId((data as string) ?? null);
    setMessage({ type: "ok", text: "Contest cloned as a new draft." });
  }

  const selectedContest = contests.find((c) => c.id === selectedContestId);
  const setAValid = setQuestions.A.length === 8;
  const allSetsValid = (["A", "B", "C"] as SetCode[]).every((s) => setQuestions[s].length === 8);

  return (
    <>
      <PageHeader title="Contests" subtitle="Build question sets A · B · C, validate composition, then publish.">
        <Button onClick={() => setShowCreateForm((v) => !v)} className="gap-2 font-semibold shadow-glow">
          <Plus className="h-4 w-4" />
          {showCreateForm ? "Cancel" : "New contest"}
        </Button>
      </PageHeader>

      {message && (
        <div className={`mb-5 flex items-center justify-between rounded-xl border p-4 text-sm ${
          message.type === "ok"
            ? "border-green/30 bg-green/10 text-green"
            : "border-destructive/30 bg-destructive/10 text-destructive"
        }`}>
          <div className="flex items-center gap-2">
            {message.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
          <button onClick={() => setMessage(null)}><X className="h-4 w-4" /></button>
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
              <p className="text-xs text-muted-foreground">Fill details, save, then assign questions to each set.</p>
            </div>
          </div>
          <div className="grid gap-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contest title (e.g. Nilgiri Winter Cup 2026)"
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
                <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-bg3 px-3 text-sm text-foreground focus:border-cyan focus:outline-none" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Ends (IST)
                <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-bg3 px-3 text-sm text-foreground focus:border-cyan focus:outline-none" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="number" min="1" max="480" value={duration} onChange={(e) => setDuration(e.target.value)}
                  className="h-9 w-20 rounded-xl border border-border bg-bg3 px-3 text-sm text-center font-mono focus:border-cyan focus:outline-none" />
                minutes duration
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium select-none"
                onClick={() => setPractice((v) => !v)}>
                <div className={`relative h-5 w-9 rounded-full transition-colors ${practice ? "bg-cyan" : "bg-border"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${practice ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                Practice mode
              </label>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => void createDraft()} className="gap-2 shadow-glow font-bold">
                <Plus className="h-4 w-4" /> Create draft
              </Button>
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Contest list */}
      <GlassCard className="mb-6 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-bold text-sm">All contests</h2>
          <span className="text-xs text-muted-foreground">{contests.length} total</span>
        </div>
        {contests.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">No contests yet. Create your first one above.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {contests.map((c) => {
              const isSelected = selectedContestId === c.id;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    c.is_draft ? "cursor-pointer hover:bg-bg3" : ""
                  } ${isSelected ? "bg-cyan/5 border-l-2 border-l-cyan" : ""}`}
                  onClick={() => c.is_draft && setSelectedContestId(isSelected ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.title}</span>
                      {isSelected && <span className="text-[10px] rounded-full bg-cyan/20 text-cyan px-2 py-0.5 font-bold">EDITING</span>}
                      {c.is_practice && <span className="text-[10px] rounded-full bg-gold/20 text-gold px-2 py-0.5 font-bold">PRACTICE</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {formatIST(c.start_time)} → {formatIST(c.end_time)} · {c.duration_minutes}m
                    </p>
                  </div>
                  <StatusPill status={contestStatus(c)} />
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to="/admin/contests/$id/monitor"
                      params={{ id: c.id }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan hover:bg-cyan/10 transition-colors"
                    >
                      Monitor
                    </Link>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); void clone(c.id); }}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Clone
                    </Button>
                    {c.is_draft && (
                      <ChevronRight className={`h-4 w-4 transition-transform text-cyan ${isSelected ? "rotate-90" : ""}`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Question builder */}
      {selectedContestId && selectedContest && (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          {/* Left: question picker */}
          <div className="space-y-4">
            <GlassCard className="p-0 overflow-hidden">
              {/* Set tabs header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan" />
                  <h2 className="font-bold text-sm truncate max-w-[200px]">"{selectedContest.title}"</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {(["A", "B", "C"] as SetCode[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSet(s)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all border ${
                        activeSet === s ? SET_COLORS[s] : "text-muted-foreground border-transparent hover:border-border"
                      }`}
                    >
                      Set {s}
                      {setQuestions[s].length > 0 && (
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${SET_BADGE[s]}`}>
                          {setQuestions[s].length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search + filter */}
              <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text" placeholder="Search questions..." value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-full rounded-xl border border-border bg-bg3 pl-10 pr-4 text-sm focus:border-cyan focus:outline-none"
                  />
                </div>
                <div className="flex gap-1">
                  {(["all", "mcq", "coding"] as const).map((f) => (
                    <button key={f} onClick={() => setTypeFilter(f)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors capitalize ${
                        typeFilter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-bg3"
                      }`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question list */}
              <div className="max-h-[520px] overflow-y-auto p-4 space-y-2">
                {filteredQuestions.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">No questions match your filter.</p>
                ) : (
                  filteredQuestions.map((q) => {
                    const isSelected = currentIds.includes(q.id);
                    const position = isSelected ? currentIds.indexOf(q.id) + 1 : undefined;
                    const idx = currentIds.indexOf(q.id);
                    return (
                      <QuestionPickerRow
                        key={q.id}
                        q={q}
                        isSelected={isSelected}
                        position={position}
                        onToggle={() => toggleQuestion(q.id)}
                        onMoveUp={() => moveQuestion(q.id, "up")}
                        onMoveDown={() => moveQuestion(q.id, "down")}
                        isFirst={idx === 0}
                        isLast={idx === currentIds.length - 1}
                      />
                    );
                  })
                )}
              </div>
            </GlassCard>

            {/* Save set */}
            <div className="flex items-center gap-3">
              <Button onClick={() => void saveSet(activeSet)} variant="secondary" className="gap-2 font-semibold">
                <ListChecks className="h-4 w-4" /> Save Set {activeSet} ({currentIds.length}/8)
              </Button>
              <span className="text-xs text-muted-foreground">Save each set separately before publishing.</span>
            </div>
          </div>

          {/* Right: composition + actions */}
          <div className="space-y-4">
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-cyan" />
                <h3 className="font-bold text-sm">Set {activeSet} — Composition</h3>
              </div>
              <CompositionStatus ids={currentIds} questions={questions} />
            </GlassCard>

            <GlassCard>
              <h3 className="font-bold text-sm mb-3">All sets overview</h3>
              <div className="space-y-2">
                {(["A", "B", "C"] as SetCode[]).map((s) => (
                  <div key={s}
                    className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                      activeSet === s ? SET_COLORS[s] : "border-border bg-bg3/50 hover:bg-bg3"
                    }`}
                    onClick={() => setActiveSet(s)}>
                    <span className="font-bold text-sm">Set {s}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">{setQuestions[s].length}/8</span>
                      {setQuestions[s].length === 8
                        ? <CheckCircle2 className="h-4 w-4 text-green" />
                        : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
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
                Once Set A is saved with all 8 questions, auto-generate two shuffled versions
                (B & C) — ensures every student sees a different question order.
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
                  Save Set A with 8 questions first.
                </p>
              )}
            </GlassCard>

            <GlassCard className={allSetsValid ? "border-green/30" : ""}>
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4 text-green" />
                <h3 className="font-bold text-sm">Publish contest</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Publishing locks the contest permanently. All 3 sets must each have
                5 MCQs + 3 Coding (E/M/H) = 20 marks total.
              </p>
              <Button
                onClick={() => void publish()}
                disabled={!allSetsValid}
                className={`w-full gap-2 font-bold ${allSetsValid ? "bg-green hover:bg-green/80 text-black shadow-glow" : ""}`}
              >
                <Send className="h-4 w-4" /> Publish & Lock Contest
              </Button>
              {!allSetsValid && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  All 3 sets must be saved with valid compositions.
                </p>
              )}
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm">Contest details</h3>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground font-mono">
                <p className="text-foreground font-semibold">{selectedContest.title}</p>
                <p>{formatIST(selectedContest.start_time)} → {formatIST(selectedContest.end_time)}</p>
                <p>{selectedContest.duration_minutes} min · {selectedContest.is_practice ? "Practice" : "Ranked"}</p>
              </div>
              <Button variant="ghost" size="sm" className="mt-3 h-7 text-xs w-full gap-1.5"
                onClick={() => setSelectedContestId(null)}>
                <Trash2 className="h-3.5 w-3.5" /> Deselect contest
              </Button>
            </GlassCard>
          </div>
        </div>
      )}
    </>
  );
}
