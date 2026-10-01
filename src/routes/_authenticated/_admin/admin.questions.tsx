import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
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
  };
}

function Questions() {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-questions"],
    queryFn: async () =>
      (
        await supabase
          .from("questions")
          .select("*")
          .order("type", { ascending: false })
          .order("marks")
      ).data ?? [],
  });
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      const { error } = await supabase.rpc("admin_upsert_question", {
        _id: draft.id,
        _type: draft.type,
        _title: draft.title,
        _body: draft.body,
        _options: options,
        _correct_option: draft.type === "mcq" ? Number(draft.correctOption) : null,
        _difficulty: draft.type === "coding" ? draft.difficulty : null,
        _code_language: draft.codeLanguage,
        _test_cases: testCases,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      setDraft(null);
      setMessage("Question saved.");
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
      <PageHeader title="Question bank" subtitle="MCQ = 1 mark · Coding: Easy 3, Medium 5, Hard 7">
        <Button
          onClick={() => {
            setDraft({ ...emptyDraft });
            setMessage(null);
          }}
        >
          <Plus className="h-4 w-4" /> New question
        </Button>
      </PageHeader>
      {message && (
        <p className="mb-5 rounded-md border border-border bg-bg3 p-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {draft && (
        <GlassCard className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{draft.id ? "Edit question" : "New question"}</h2>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Type
                <select
                  value={draft.type}
                  onChange={(event) =>
                    setDraft({ ...draft, type: event.target.value as QuestionDraft["type"] })
                  }
                  className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm text-foreground"
                >
                  <option value="mcq">MCQ</option>
                  <option value="coding">Coding</option>
                </select>
              </label>
              {draft.type === "coding" ? (
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Difficulty
                  <select
                    value={draft.difficulty}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        difficulty: event.target.value as QuestionDraft["difficulty"],
                      })
                    }
                    className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm text-foreground"
                  >
                    <option value="easy">Easy · 3 marks</option>
                    <option value="medium">Medium · 5 marks</option>
                    <option value="hard">Hard · 7 marks</option>
                  </select>
                </label>
              ) : (
                <div />
              )}
            </div>
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Question title"
              className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm"
            />
            <textarea
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              placeholder="Question body or Markdown"
              className="min-h-28 rounded-md border border-border bg-bg3 p-3 font-mono text-sm"
            />
            {draft.type === "mcq" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Options, one per line
                  <textarea
                    value={draft.optionsText}
                    onChange={(event) => setDraft({ ...draft, optionsText: event.target.value })}
                    className="min-h-28 rounded-md border border-border bg-bg3 p-3 text-sm"
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Correct option index (A = 0)
                  <input
                    type="number"
                    min="0"
                    value={draft.correctOption}
                    onChange={(event) => setDraft({ ...draft, correctOption: event.target.value })}
                    className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm"
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Language
                  <input
                    value={draft.codeLanguage}
                    onChange={(event) => setDraft({ ...draft, codeLanguage: event.target.value })}
                    className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm"
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Test cases JSON
                  <textarea
                    value={draft.testCasesText}
                    onChange={(event) => setDraft({ ...draft, testCasesText: event.target.value })}
                    className="min-h-28 rounded-md border border-border bg-bg3 p-3 font-mono text-xs"
                  />
                </label>
              </div>
            )}
            <Button onClick={() => void saveQuestion()} className="w-fit">
              <Save className="h-4 w-4" /> Save question
            </Button>
          </div>
        </GlassCard>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((q) => (
          <GlassCard key={q.id}>
            <div className="flex items-start justify-between gap-3 font-mono text-xs uppercase">
              <span className="text-violet">{q.type}</span>
              <div className="flex items-center gap-2">
                <span className={q.difficulty ? diffColor[q.difficulty] : "text-muted-foreground"}>
                  {q.difficulty ?? ""} · {q.marks} mark{q.marks > 1 ? "s" : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setDraft(draftFromQuestion(q))}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive"
                  onClick={() => void deleteQuestion(q.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <h3 className="mt-2 font-semibold">{q.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{q.body}</p>
            {Array.isArray(q.options) && (
              <ol className="mt-2 space-y-0.5 font-mono text-xs">
                {(q.options as string[]).map((o, i) => (
                  <li
                    key={i}
                    className={i === q.correct_option ? "text-green" : "text-muted-foreground"}
                  >
                    {String.fromCharCode(65 + i)}. {o}
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>
        ))}
      </div>
    </>
  );
}
