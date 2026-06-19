"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  ScanText,
} from "lucide-react";
import { useState } from "react";
import ruleBank from "../rules/rule_bank_v0.json";

type AnalyzeError = {
  span: { start: number; end: number; text: string };
  category: string;
  rule_id: string;
  severity: number;
  correction: string;
  confidence: number;
};

type AnalyzeDrill = {
  rule_id: string;
  type:
    | "rewrite"
    | "fill_blank"
    | "multiple_choice"
    | "spot_error"
    | "explain_choice";
  prompt: string;
  answer: string;
  options?: string[];
};

type CategoryStats = {
  category: string;
  subcategory: string;
  count: number;
};

type RewriteComparison = {
  previous_error_count: number;
  current_error_count: number;
  fixed_rule_ids: string[];
  remaining_rule_ids: string[];
  new_rule_ids: string[];
  score_delta: number;
};

type AnalyzeResponse = {
  errors: AnalyzeError[];
  corrected_text: string;
  unmapped: unknown[];
  drills: AnalyzeDrill[];
  category_stats: CategoryStats[];
  grammar_score: number;
  analysis_status: "ok" | "degraded";
  comparison?: RewriteComparison;
};

type RuleSummary = {
  rule_id: string;
  title: string;
  learner_explanation?: string;
};

type DrillState = {
  input: string;
  selected?: string;
  checked: boolean;
  isCorrect: boolean | null;
  showAnswer: boolean;
};

type HighlightSegment =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string; correction: string };

const DEFAULT_TEXT =
  "La coche nuevo es roja y bonita, pero mi hermana dice que es vieja. " +
  "Soy en casa ahora y pienso sobre mi futuro. Conozco María desde hace años.";

const loopSteps = ["Write", "Diagnose", "Drill", "Rewrite", "Compare"];

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const formatScore = (score: number) => `${Math.round(score * 100)}%`;

const toPreviousErrors = (errors: AnalyzeError[]) =>
  errors.map((error) => ({
    rule_id: error.rule_id,
    span_text: error.span.text,
    correction: error.correction,
  }));

const formatCategory = (stat: CategoryStats) =>
  `${stat.category.toLowerCase().replace("_", " ")} / ${stat.subcategory}`;

export default function Home() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [lastResult, setLastResult] = useState<AnalyzeResponse | null>(null);
  const [lastSubmittedText, setLastSubmittedText] = useState("");
  const [rewriteText, setRewriteText] = useState("");
  const [activeTab, setActiveTab] = useState<"diagnosis" | "practice">(
    "diagnosis"
  );
  const [drillState, setDrillState] = useState<Record<number, DrillState>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ruleMap = new Map(
    (ruleBank as RuleSummary[]).map((rule) => [rule.rule_id, rule])
  );

  const buildHighlightSegments = (
    source: string,
    errors: AnalyzeError[]
  ): { segments: HighlightSegment[]; hasInvalid: boolean } => {
    if (!source || errors.length === 0) {
      return { segments: [{ type: "text", value: source }], hasInvalid: false };
    }

    const ordered = [...errors].sort((a, b) => a.span.start - b.span.start);
    const segments: HighlightSegment[] = [];
    let cursor = 0;

    for (const item of ordered) {
      const { start, end } = item.span;
      const valid =
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= cursor &&
        end <= source.length &&
        start < end;

      if (!valid) {
        return { segments: [{ type: "text", value: source }], hasInvalid: true };
      }

      if (cursor < start) {
        segments.push({ type: "text", value: source.slice(cursor, start) });
      }

      segments.push({
        type: "highlight",
        value: source.slice(start, end),
        correction: item.correction,
      });
      cursor = end;
    }

    if (cursor < source.length) {
      segments.push({ type: "text", value: source.slice(cursor) });
    }

    return { segments, hasInvalid: false };
  };

  const analyzeWithText = async (
    submissionText: string,
    previous?: AnalyzeResponse
  ) => {
    setIsLoading(true);
    setError(null);
    setActiveTab("diagnosis");
    setDrillState({});

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: submissionText,
          previous_errors: previous ? toPreviousErrors(previous.errors) : undefined,
          previous_grammar_score: previous?.grammar_score,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Analyze request failed.";
        throw new Error(message);
      }

      const data = (await response.json()) as AnalyzeResponse;
      setLastResult(previous ?? result);
      setResult(data);
      setLastSubmittedText(submissionText);
      setRewriteText(data.corrected_text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderDrillAnswerControls = (drill: AnalyzeDrill, index: number) => {
    const state = drillState[index];

    if (drill.type === "multiple_choice" && drill.options?.length) {
      return (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {drill.options.map((option) => {
            const selected = state?.selected === option;
            return (
              <button
                key={option}
                type="button"
                className={`liquid-glass rounded-full px-4 py-2 text-left text-sm text-white transition-transform hover:scale-[1.01] active:scale-[0.99] ${
                  selected ? "bg-white/15" : "bg-white/5"
                }`}
                onClick={() => {
                  const isCorrect = normalize(option) === normalize(drill.answer);
                  setDrillState((previous) => ({
                    ...previous,
                    [index]: {
                      input: "",
                      selected: option,
                      checked: true,
                      isCorrect,
                      showAnswer: false,
                    },
                  }));
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    const useTextarea = drill.type === "rewrite" || drill.type === "spot_error";

    return (
      <div className="mt-4 flex flex-col gap-3">
        {useTextarea ? (
          <textarea
            className="min-h-28 rounded-2xl bg-black/25 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/35"
            value={state?.input ?? ""}
            onChange={(event) =>
              setDrillState((previous) => ({
                ...previous,
                [index]: {
                  input: event.target.value,
                  checked: false,
                  isCorrect: null,
                  showAnswer: previous[index]?.showAnswer ?? false,
                },
              }))
            }
            placeholder="Repair it here"
          />
        ) : (
          <input
            className="rounded-full bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            value={state?.input ?? ""}
            onChange={(event) =>
              setDrillState((previous) => ({
                ...previous,
                [index]: {
                  input: event.target.value,
                  checked: false,
                  isCorrect: null,
                  showAnswer: previous[index]?.showAnswer ?? false,
                },
              }))
            }
            placeholder="Type the repair"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
            onClick={() => {
              const input = state?.input ?? "";
              const isCorrect = normalize(input) === normalize(drill.answer);
              setDrillState((previous) => ({
                ...previous,
                [index]: {
                  input,
                  checked: true,
                  isCorrect,
                  showAnswer: previous[index]?.showAnswer ?? false,
                },
              }));
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Check
          </button>
          <button
            type="button"
            className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-white/80 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            onClick={() =>
              setDrillState((previous) => ({
                ...previous,
                [index]: {
                  input: previous[index]?.input ?? "",
                  checked: previous[index]?.checked ?? false,
                  isCorrect: previous[index]?.isCorrect ?? null,
                  showAnswer: true,
                },
              }))
            }
          >
            <BookOpen className="h-3.5 w-3.5" />
            Show answer
          </button>
        </div>
      </div>
    );
  };

  const { segments, hasInvalid } = buildHighlightSegments(
    lastSubmittedText,
    result?.errors ?? []
  );
  const degraded = result?.analysis_status === "degraded";
  const noValidatedErrors =
    result && !degraded && result.errors.length === 0 && !isLoading;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.14),transparent_26%),radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(135deg,#050505_0%,#151515_52%,#050505_100%)]" />
      <div className="fixed inset-0 z-[1] bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px] opacity-35" />

      <section className="relative z-10 flex min-h-screen flex-col gap-4 p-3 sm:p-4">
        <header className="liquid-glass-strong flex flex-col gap-4 rounded-[1.75rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="liquid-glass-strong flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold">
              V
            </div>
            <div>
              <div className="text-2xl font-semibold tracking-[-0.05em]">
                Verbum
              </div>
              <div className="text-xs text-white/50">
                Grammar repair for Spanish writing
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            {loopSteps.map((step) => (
              <span key={step} className="liquid-glass rounded-full px-3 py-1.5">
                {step}
              </span>
            ))}
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-7.5rem)] gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="liquid-glass-strong flex min-h-[34rem] flex-col rounded-[2rem] p-5 sm:p-6">
            <div className="mb-4">
              <h1 className="text-3xl font-medium tracking-[-0.05em] sm:text-4xl">
                Write. Diagnose. Repair.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                Minimal corrections. Rule-backed explanations. Drills from this
                text. No prose polish.
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              <div className="liquid-glass flex flex-1 flex-col rounded-[1.75rem] p-3">
                <div className="mb-3 flex items-center justify-between px-1 text-xs text-white/55">
                  <label htmlFor="input-text">Spanish text</label>
                  <span
                    className={
                      text.length > 2000 || text.trim().length < 10
                        ? "text-white"
                        : "text-white/45"
                    }
                  >
                    {text.length}/2000
                  </span>
                </div>
                <textarea
                  id="input-text"
                  className="min-h-[20rem] flex-1 resize-y rounded-[1.35rem] bg-black/25 p-4 text-sm leading-6 text-white outline-none placeholder:text-white/35 lg:min-h-[26rem]"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Escribe en español."
                  maxLength={2500}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => analyzeWithText(text)}
                  disabled={
                    isLoading || text.trim().length < 10 || text.length > 2000
                  }
                  className="liquid-glass-strong inline-flex items-center justify-center gap-3 rounded-full px-5 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                    <ScanText className="h-4 w-4" />
                  </span>
                  {isLoading ? "Diagnosing..." : "Diagnose grammar"}
                  <ArrowRight className="h-4 w-4" />
                </button>
                {error ? (
                  <div className="liquid-glass rounded-full px-4 py-2 text-xs text-white">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="liquid-glass-strong flex min-h-[34rem] flex-col gap-4 rounded-[2rem] p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Errors" value={result ? result.errors.length : "-"} />
              <Metric
                label="Score"
                value={result ? formatScore(result.grammar_score) : "-"}
              />
              <Metric label="Drills" value={result ? result.drills.length : "-"} />
            </div>

            {degraded ? (
              <div className="rounded-[1.5rem] bg-amber-400/20 p-4 text-sm leading-6 text-amber-50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Analysis degraded
                </div>
                The model response could not be validated. Do not treat this as
                clean Spanish.
              </div>
            ) : null}

            {result?.comparison ? (
              <div className="liquid-glass rounded-[1.5rem] p-4 text-sm text-white/80">
                <div className="mb-2 flex items-center gap-2 font-medium text-white">
                  <CheckCircle2 className="h-4 w-4" />
                  Rewrite comparison
                </div>
                {result.comparison.previous_error_count} to{" "}
                {result.comparison.current_error_count} errors. Fixed{" "}
                {result.comparison.fixed_rule_ids.length}; remaining{" "}
                {result.comparison.remaining_rule_ids.length}; new{" "}
                {result.comparison.new_rule_ids.length}. Score{" "}
                {result.comparison.score_delta >= 0 ? "+" : ""}
                {Math.round(result.comparison.score_delta * 100)} points.
              </div>
            ) : null}

            {result?.category_stats.length ? (
              <div className="flex flex-wrap gap-2">
                {result.category_stats.map((stat) => (
                  <span
                    key={`${stat.category}-${stat.subcategory}`}
                    className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/70"
                  >
                    {formatCategory(stat)} · {stat.count}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="liquid-glass flex gap-1 rounded-full p-1">
              {(["diagnosis", "practice"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium capitalize transition-transform hover:scale-[1.01] active:scale-[0.99] ${
                    activeTab === tab
                      ? "bg-white/18 text-white"
                      : "text-white/55 hover:text-white/80"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {!result && !isLoading ? <EmptyState /> : null}

            {isLoading ? (
              <div className="liquid-glass flex flex-1 items-center justify-center rounded-[1.75rem] p-8 text-center text-sm text-white/65">
                Diagnosing the text against the rule bank...
              </div>
            ) : null}

            {result && !isLoading && activeTab === "diagnosis" ? (
              <DiagnosisPanel
                degraded={degraded}
                noValidatedErrors={Boolean(noValidatedErrors)}
                hasInvalid={hasInvalid}
                segments={segments}
                result={result}
                ruleMap={ruleMap}
                rewriteText={rewriteText}
                setRewriteText={setRewriteText}
                compareRewrite={() => analyzeWithText(rewriteText, result)}
                isLoading={isLoading}
                lastResult={lastResult}
              />
            ) : null}

            {result && !isLoading && activeTab === "practice" ? (
              <PracticePanel
                drills={result.drills}
                drillState={drillState}
                renderControls={renderDrillAnswerControls}
              />
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="liquid-glass rounded-[1.35rem] p-3">
      <div className="text-[0.65rem] uppercase tracking-[0.16em] text-white/45">
        {label}
      </div>
      <div className="mt-1 text-2xl font-medium tracking-[-0.04em] text-white">
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="liquid-glass flex flex-1 flex-col justify-between rounded-[1.75rem] p-5">
      <div>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <ScanText className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-medium tracking-[-0.04em]">
          Diagnosis waits here.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-white/60">
          Submit a Spanish text. Verbum will show validated grammar repairs,
          drills, and a rewrite comparison.
        </p>
      </div>
      <div className="mt-8 text-xs uppercase tracking-[0.18em] text-white/40">
        Write · Diagnose · Drill · Rewrite · Compare
      </div>
    </div>
  );
}

function DiagnosisPanel({
  degraded,
  noValidatedErrors,
  hasInvalid,
  segments,
  result,
  ruleMap,
  rewriteText,
  setRewriteText,
  compareRewrite,
  isLoading,
  lastResult,
}: {
  degraded: boolean;
  noValidatedErrors: boolean;
  hasInvalid: boolean;
  segments: HighlightSegment[];
  result: AnalyzeResponse;
  ruleMap: Map<string, RuleSummary>;
  rewriteText: string;
  setRewriteText: (value: string) => void;
  compareRewrite: () => void;
  isLoading: boolean;
  lastResult: AnalyzeResponse | null;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="liquid-glass rounded-[1.75rem] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-white">Marked text</h2>
            {hasInvalid ? (
              <span className="text-xs text-amber-100">Highlight issue</span>
            ) : null}
          </div>
          <p className="max-h-44 overflow-auto rounded-[1.2rem] bg-black/25 p-3 text-sm leading-7 text-white/78 xl:max-h-48">
            {segments.map((segment, index) =>
              segment.type === "text" ? (
                <span key={`text-${index}`}>{segment.value}</span>
              ) : (
                <span key={`mark-${index}`} className="group relative inline-flex">
                  <mark className="rounded-md bg-white/22 px-1 py-0.5 text-white">
                    {segment.value}
                  </mark>
                  <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-max max-w-64 rounded-2xl bg-white px-3 py-2 text-xs text-zinc-950 shadow-lg group-hover:block">
                    Fix: {segment.correction}
                  </span>
                </span>
              )
            )}
          </p>
        </div>

        <div className="liquid-glass rounded-[1.75rem] p-4">
          <h2 className="mb-3 text-sm font-medium text-white">Repairs</h2>
          {degraded ? (
            <p className="text-sm leading-6 text-white/65">
              Repairs are hidden because this result degraded.
            </p>
          ) : null}
          {noValidatedErrors ? (
            <p className="text-sm leading-6 text-white/65">
              No rule-backed grammar errors found.
            </p>
          ) : null}
          {!degraded && result.errors.length > 0 ? (
            <ul className="max-h-52 space-y-3 overflow-auto pr-1 xl:max-h-56">
              {result.errors.map((item, index) => {
                const rule = ruleMap.get(item.rule_id);
                return (
                  <li
                    key={`${item.rule_id}-${index}`}
                    className="rounded-[1.2rem] bg-black/25 p-3 text-sm"
                  >
                    <div className="font-medium text-white">
                      {item.span.text} -&gt; {item.correction}
                    </div>
                    {rule?.learner_explanation ? (
                      <p className="mt-2 leading-6 text-white/58">
                        {rule.learner_explanation}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="liquid-glass rounded-[1.75rem] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-white">Rewrite and compare</h2>
          <span className="text-xs text-white/40">{rewriteText.length}/2000</span>
        </div>
        <textarea
          className="min-h-56 w-full resize-y rounded-[1.25rem] bg-black/25 p-4 text-sm leading-6 text-white outline-none placeholder:text-white/35 lg:min-h-64"
          value={rewriteText}
          onChange={(event) => setRewriteText(event.target.value)}
          placeholder="Rewrite the repaired version here"
        />
        <button
          type="button"
          onClick={compareRewrite}
          disabled={isLoading || rewriteText.trim().length < 10 || degraded}
          className="liquid-glass-strong mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Compare rewrite
        </button>
      </div>

      <details className="liquid-glass rounded-[1.5rem] p-3 text-sm text-white/70">
        <summary className="cursor-pointer text-white/85">
          Details and unmapped ({result.unmapped.length})
        </summary>
        <div className="mt-3 space-y-2">
          {lastResult ? (
            <div className="rounded-2xl bg-black/25 p-3">
              Previous analyzed text had {lastResult.errors.length} errors.
            </div>
          ) : null}
          {result.errors.map((item, index) => (
            <div
              key={`detail-${item.rule_id}-${index}`}
              className="rounded-2xl bg-black/25 p-3"
            >
              {item.rule_id} / severity {item.severity} / confidence{" "}
              {item.confidence.toFixed(2)}
            </div>
          ))}
          {result.unmapped.map((item, index) => (
            <div key={`unmapped-${index}`} className="rounded-2xl bg-black/25 p-3">
              {typeof item === "string" ? item : JSON.stringify(item)}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function PracticePanel({
  drills,
  drillState,
  renderControls,
}: {
  drills: AnalyzeDrill[];
  drillState: Record<number, DrillState>;
  renderControls: (drill: AnalyzeDrill, index: number) => React.ReactNode;
}) {
  if (drills.length === 0) {
    return (
      <div className="liquid-glass flex flex-1 items-center justify-center rounded-[1.75rem] p-8 text-center text-sm text-white/62">
        No drills because no validated errors were found.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-auto pr-1">
      {drills.map((drill, index) => {
        const state = drillState[index];
        return (
          <article
            key={`${drill.rule_id}-${drill.type}-${index}`}
            className="liquid-glass rounded-[1.75rem] p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                {drill.type.replace("_", " ")}
              </div>
              {state?.checked ? (
                <div
                  className={`inline-flex items-center gap-1.5 text-xs ${
                    state.isCorrect ? "text-white" : "text-white/65"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {state.isCorrect ? "Correct" : "Try again"}
                </div>
              ) : null}
            </div>
            <div className="text-sm font-medium leading-6 text-white">
              {drill.prompt}
            </div>
            {renderControls(drill, index)}
            {state?.checked || state?.showAnswer ? (
              <div className="mt-3 rounded-2xl bg-black/25 p-3 text-xs leading-5 text-white/62">
                Answer: {drill.answer}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
