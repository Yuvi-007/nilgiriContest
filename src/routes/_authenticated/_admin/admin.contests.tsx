import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, PageHeader, StatusPill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { contestsQuery } from "@/lib/queries";
import { contestStatus, formatIST } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_admin/admin/contests")({
  head: () => ({ meta: [{ title: "Contests — nilgiriContest admin" }] }),
  component: AdminContests,
});

function AdminContests() {
  const queryClient = useQueryClient();
  const { data: contests = [] } = useQuery(contestsQuery);
  const { data: questions = [] } = useQuery({
    queryKey: ["admin-builder-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id,title,type,difficulty,marks")
        .order("type")
        .order("marks");
      if (error) throw error;
      return data;
    },
  });
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [practice, setPractice] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => questions.filter((question) => selectedQuestions.includes(question.id)),
    [questions, selectedQuestions],
  );
  const mcqCount = selected.filter((question) => question.type === "mcq").length;
  const codingCount = selected.filter((question) => question.type === "coding").length;
  const totalMarks = selected.reduce((total, question) => total + question.marks, 0);
  const validComposition =
    selected.length === 8 && mcqCount === 5 && codingCount === 3 && totalMarks === 20;

  useEffect(() => {
    if (!selectedContestId) return setSelectedQuestions([]);
    supabase
      .from("contest_questions")
      .select("question_id")
      .eq("contest_id", selectedContestId)
      .order("position")
      .then(({ data }) => setSelectedQuestions((data ?? []).map((row) => row.question_id)));
  }, [selectedContestId]);

  async function createDraft() {
    setMessage(null);
    if (!title || !startTime || !endTime)
      return setMessage("Title, start time, and end time are required.");
    const { data, error } = await supabase.rpc("admin_create_draft_contest", {
      _title: title,
      _description: description,
      _start_time: new Date(startTime).toISOString(),
      _end_time: new Date(endTime).toISOString(),
      _duration_minutes: Number(duration),
      _is_practice: practice,
    });
    if (error) return setMessage(error.message);
    await queryClient.invalidateQueries({ queryKey: ["contests"] });
    setSelectedContestId(data);
    setTitle("");
    setDescription("");
    setMessage("Draft created. Select questions before publishing.");
  }

  async function saveQuestions() {
    if (!selectedContestId) return;
    setMessage(null);
    const { error } = await supabase.rpc("admin_set_contest_questions", {
      _contest_id: selectedContestId,
      _question_ids: selectedQuestions,
    });
    setMessage(error ? error.message : "Question order saved.");
  }

  async function publish() {
    if (!selectedContestId || !validComposition)
      return setMessage("Select 5 MCQs and 3 coding questions totalling 20 marks.");
    const { error } = await supabase.rpc("admin_publish_contest", {
      _contest_id: selectedContestId,
    });
    if (error) return setMessage(error.message);
    await queryClient.invalidateQueries({ queryKey: ["contests"] });
    setMessage("Contest published and locked.");
  }

  async function clone(contestId: string) {
    const { data, error } = await supabase.rpc("admin_clone_contest", { _source_id: contestId });
    if (error) return setMessage(error.message);
    await queryClient.invalidateQueries({ queryKey: ["contests"] });
    setSelectedContestId(data);
    setMessage("Contest cloned as a draft.");
  }

  return (
    <>
      <PageHeader
        title="Contests"
        subtitle="Build drafts, validate the 20-mark composition, then publish once."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <GlassCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Contest builder</h2>
              <p className="text-sm text-muted-foreground">Create a new draft</p>
            </div>
            <Plus className="h-5 w-5 text-cyan" />
          </div>
          <div className="mt-5 grid gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Contest title"
              className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              className="min-h-20 rounded-md border border-border bg-bg3 p-3 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Starts
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm text-foreground"
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Ends
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm text-foreground"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  className="h-9 w-20 rounded-md border border-border bg-bg3 px-2"
                />{" "}
                minutes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={practice}
                  onChange={(event) => setPractice(event.target.checked)}
                />{" "}
                Practice contest
              </label>
            </div>
            <Button onClick={() => void createDraft()} className="w-fit">
              <Plus className="h-4 w-4" /> Create draft
            </Button>
          </div>
        </GlassCard>
        <GlassCard>
          <h2 className="font-bold">Composition check</h2>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-bg3 p-3">
              <strong className="block font-mono text-lg">{mcqCount}/5</strong>MCQs
            </div>
            <div className="rounded-md bg-bg3 p-3">
              <strong className="block font-mono text-lg">{codingCount}/3</strong>Coding
            </div>
            <div className="rounded-md bg-bg3 p-3">
              <strong className="block font-mono text-lg">{totalMarks}/20</strong>Marks
            </div>
          </div>
          <p
            className={`mt-4 text-sm ${validComposition ? "text-green" : "text-muted-foreground"}`}
          >
            {validComposition
              ? "Ready to publish."
              : "Choose exactly 5 MCQs and 3 coding questions."}
          </p>
          {message && (
            <p className="mt-3 rounded-md border border-border bg-bg3 p-3 text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </GlassCard>
      </div>
      <div className="mt-6 glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Title</th>
              <th className="p-3">Status</th>
              <th className="p-3">Window (IST)</th>
              <th className="p-3">Duration</th>
              <th className="p-3">Type</th>
            </tr>
          </thead>
          <tbody>
            {contests.map((c) => (
              <tr
                key={c.id}
                onClick={() => c.is_draft && setSelectedContestId(c.id)}
                className={`border-b border-border/50 last:border-0 ${c.is_draft ? "cursor-pointer hover:bg-bg3" : ""}`}
              >
                <td className="p-3 font-medium">
                  {c.title}
                  {selectedContestId === c.id && (
                    <span className="ml-2 text-xs text-cyan">selected</span>
                  )}
                </td>
                <td className="p-3">
                  <StatusPill status={contestStatus(c)} />
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">
                  {formatIST(c.start_time)} → {formatIST(c.end_time)}
                </td>
                <td className="p-3 font-mono">{c.duration_minutes}m</td>
                <td className="p-3">
                  <span>
                    {c.is_practice ? <span className="text-gold">Practice</span> : "Ranked"}
                  </span>
                  <Link
                    to="/admin/contests/$id/monitor"
                    params={{ id: c.id }}
                    className="ml-2 text-xs text-cyan hover:underline"
                  >
                    Monitor
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-7"
                    onClick={(event) => {
                      event.stopPropagation();
                      void clone(c.id);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Clone
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedContestId && (
        <GlassCard className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Questions for selected draft</h2>
              <p className="text-sm text-muted-foreground">
                Click questions to add or remove them. Order follows selection order.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void saveQuestions()}>
                <Save className="h-4 w-4" /> Save questions
              </Button>
              <Button onClick={() => void publish()} disabled={!validComposition}>
                <Send className="h-4 w-4" /> Publish
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {questions.map((question) => (
              <label
                key={question.id}
                className="flex items-start gap-3 rounded-md border border-border bg-bg3 p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedQuestions.includes(question.id)}
                  onChange={() =>
                    setSelectedQuestions((ids) =>
                      ids.includes(question.id)
                        ? ids.filter((id) => id !== question.id)
                        : [...ids, question.id],
                    )
                  }
                />
                <span>
                  <strong className="block">{question.title}</strong>
                  <span className="text-xs text-muted-foreground">
                    {question.type} · {question.marks} mark{question.marks === 1 ? "" : "s"}
                    {question.difficulty ? ` · ${question.difficulty}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </GlassCard>
      )}
    </>
  );
}
