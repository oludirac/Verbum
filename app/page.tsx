"use client";

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
  rule_id?: string;
  type: string;
  prompt: string;
  answer: string;
  options?: string[];
};

type CategoryStats = {
  category: string;
  subcategory: string;
  count: number;
};

type AnalyzeResponse = {
  grammar_score: number;
  errors: AnalyzeError[];
  corrected_text: string;
  unmapped: unknown[];
  drills: AnalyzeDrill[];
  category_stats?: CategoryStats[];
};

type HighlightSegment =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string; correction: string };

type DrillState = {
  input: string;
  selected?: string;
  checked: boolean;
  isCorrect: boolean | null;
  showAnswer: boolean;
};

const DEFAULT_TEXT =
  "La coche nuevo es roja y bonita, pero mi hermana dice que es vieja. " +
  "Soy en casa ahora y pienso sobre mi futuro. Conozco María desde hace años.";

export default function Home() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "practice">(
    "results"
  );
  const [drillState, setDrillState] = useState<Record<number, DrillState>>({});
  const [previousAttempt, setPreviousAttempt] = useState<{
    text: string;
    score: number;
  } | null>(null);
  const [lastSubmittedText, setLastSubmittedText] = useState("");
  const [rewriteText, setRewriteText] = useState("");

  const ruleMap = new Map(
    (ruleBank as Array<{
      rule_id: string;
      title?: string;
      explanation_es?: string;
      examples?: Array<{ bad: string; good: string }>;
    }>).map((rule) => [rule.rule_id, rule])
  );

  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");

  const buildHighlightSegments = (
    source: string,
    errors: AnalyzeError[]
  ): { segments: HighlightSegment[]; hasInvalid: boolean } => {
    if (!source || errors.length === 0) {
      return { segments: [{ type: "text", value: source }], hasInvalid: false };
    }

    const ordered = [...errors].sort(
      (a, b) => a.span.start - b.span.start
    );
    let cursor = 0;
    let hasInvalid = false;
    const segments: HighlightSegment[] = [];

    for (const item of ordered) {
      const { start, end } = item.span;
      const isValid =
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end <= source.length &&
        start < end &&
        start >= cursor;

      if (!isValid) {
        hasInvalid = true;
        return {
          segments: [{ type: "text", value: source }],
          hasInvalid,
        };
      }

      if (cursor < start) {
        segments.push({
          type: "text",
          value: source.slice(cursor, start),
        });
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

    return { segments, hasInvalid };
  };

  const analyzeWithText = async (submissionText: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveTab("results");
    setDrillState({});

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: submissionText }),
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
      if (result && lastSubmittedText) {
        setPreviousAttempt({
          text: lastSubmittedText,
          score: result.grammar_score,
        });
      }
      setResult(data);
      setLastSubmittedText(submissionText);
      setRewriteText(data.corrected_text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    await analyzeWithText(text);
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Verbum v0</h1>
          <p className="text-sm text-zinc-600">
            Grammar diagnostics only. Minimal edits. Error-driven drills.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="input-text">
              Spanish text
            </label>
            <span className={`text-xs ${text.length > 2000 ? "text-red-500" : text.trim().length < 10 ? "text-amber-500" : "text-zinc-400"}`}>
              {text.length}/2000
            </span>
          </div>
          <textarea
            id="input-text"
            className={`min-h-[220px] w-full rounded-md border bg-white p-3 text-sm leading-6 shadow-sm focus:outline-none ${
              text.length > 2000 
                ? "border-red-300 focus:border-red-400" 
                : "border-zinc-200 focus:border-zinc-400"
            }`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Escribe un texto en español (mínimo 10 caracteres)."
            maxLength={2500}
          />
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isLoading || text.trim().length < 10 || text.length > 2000}
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isLoading ? "Analizando..." : "Analyze"}
          </button>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        {result ? (
          <section className="flex flex-col gap-6 rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("results")}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  activeTab === "results"
                    ? "bg-black text-white"
                    : "bg-zinc-100 text-zinc-700"
                }`}
              >
                Results
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("practice")}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  activeTab === "practice"
                    ? "bg-black text-white"
                    : "bg-zinc-100 text-zinc-700"
                }`}
              >
                Practice
              </button>
            </div>

            {activeTab === "results" ? (
              <>
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Grammar score</h2>
                    <p className="text-2xl font-semibold">
                      {result.grammar_score}
                    </p>
                  </div>

                  {result.category_stats && result.category_stats.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-medium text-zinc-600">Error breakdown</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.category_stats.map((stat) => (
                          <span
                            key={`${stat.category}-${stat.subcategory}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                          >
                            <span className="capitalize">
                              {stat.category.toLowerCase().replace("_", " ")}
                            </span>
                            <span className="text-zinc-400">·</span>
                            <span className="text-zinc-500">{stat.subcategory}</span>
                            <span className="ml-1 rounded-full bg-zinc-200 px-1.5 py-0.5 text-xs font-semibold">
                              {stat.count}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold">Highlighted text</h3>
                  {(() => {
                    const { segments, hasInvalid } = buildHighlightSegments(
                      lastSubmittedText,
                      result.errors
                    );
                    return (
                      <div className="flex flex-col gap-3">
                        {hasInvalid ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                            Some highlights could not be rendered.
                          </div>
                        ) : null}
                        <p className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm leading-7">
                          {segments.map((segment, index) => {
                            if (segment.type === "text") {
                              return (
                                <span key={`text-${index}`}>
                                  {segment.value}
                                </span>
                              );
                            }
                            return (
                              <span
                                key={`mark-${index}`}
                                className="relative inline-flex items-center"
                              >
                                <button
                                  type="button"
                                  className="peer rounded bg-amber-200 px-1 py-0.5 text-zinc-900"
                                >
                                  {segment.value}
                                </button>
                                <span className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-max max-w-[240px] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 shadow-sm peer-focus:block peer-hover:block">
                                  Fix: {segment.correction}
                                </span>
                              </span>
                            );
                          })}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold">Errors</h3>
                  {result.errors.length === 0 ? (
                    <p className="text-sm text-zinc-500">No errors reported.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {result.errors.map((item, index) => (
                        <li
                          key={`${item.rule_id}-${index}`}
                          className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm"
                        >
                          <div className="font-medium">Issue</div>
                          <div className="text-zinc-700">
                            "{item.span.text}" → {item.correction}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {result.errors.length === 0 &&
                result.corrected_text.trim() !== lastSubmittedText.trim() ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    Some changes were suggested but couldn’t be confidently
                    categorized yet.
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-semibold">Corrected text</h3>
                  <p className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm">
                    {result.corrected_text}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold">
                    Rewrite &amp; resubmit
                  </h3>
                  <textarea
                    className="min-h-[160px] w-full rounded-md border border-zinc-200 bg-white p-3 text-sm leading-6 shadow-sm focus:border-zinc-400 focus:outline-none"
                    value={rewriteText}
                    onChange={(event) => setRewriteText(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => analyzeWithText(rewriteText)}
                    disabled={isLoading}
                    className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    {isLoading ? "Analizando..." : "Re-analyze"}
                  </button>
                </div>

                {previousAttempt ? (
                  <details className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm">
                    <summary className="cursor-pointer font-medium text-zinc-700">
                      Previous attempt
                    </summary>
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="text-xs text-zinc-500">
                        Score: {previousAttempt.score}
                      </div>
                      <p className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
                        {previousAttempt.text}
                      </p>
                    </div>
                  </details>
                ) : null}

                <details className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-zinc-700">
                    Details (unmapped: {result.unmapped.length})
                  </summary>
                  <div className="mt-3 flex flex-col gap-3">
                    {result.errors.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No developer metadata available.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {result.errors.map((item, index) => {
                          const rule = ruleMap.get(item.rule_id);
                          return (
                            <li
                              key={`detail-${item.rule_id}-${index}`}
                              className="rounded-md border border-zinc-200 bg-white p-3"
                            >
                              <div className="font-medium">
                                {rule?.title ?? item.rule_id}
                              </div>
                              {rule?.explanation_es ? (
                                <p className="mt-1 text-sm text-zinc-700">
                                  {rule.explanation_es}
                                </p>
                              ) : null}
                              {rule?.examples && rule.examples.length > 0 ? (
                                <div className="mt-2 text-xs text-zinc-500">
                                  Ejemplo: {rule.examples[0].bad} →{" "}
                                  {rule.examples[0].good}
                                </div>
                              ) : null}
                              <div className="mt-2 text-xs text-zinc-500">
                                category: {item.category} · severity:{" "}
                                {item.severity} · confidence: {item.confidence}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </details>

                <details className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-zinc-700">
                    Unmapped ({result.unmapped.length})
                  </summary>
                  <div className="mt-3">
                    {result.unmapped.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No unmapped items.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2 text-sm text-zinc-700">
                        {result.unmapped.map((item, index) => (
                          <li
                            key={`unmapped-${index}`}
                            className="rounded-md border border-zinc-200 bg-white p-2"
                          >
                            {typeof item === "string"
                              ? item
                              : JSON.stringify(item)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">Drills</h3>
                {result.drills.length === 0 ? (
                  <p className="text-sm text-zinc-500">No drills reported.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {result.drills.map((drill, index) => (
                      <li
                        key={`${drill.type}-${index}`}
                        className="rounded-md border border-zinc-100 bg-zinc-50 p-4 text-sm"
                      >
                        <div className="text-xs font-semibold uppercase text-zinc-500">
                          {drill.type}
                        </div>
                        <div className="mt-2 text-sm font-medium">
                          {drill.prompt}
                        </div>

                        {drill.type === "multiple_choice" &&
                        drill.options &&
                        drill.options.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {drill.options.map((option) => {
                              const isSelected =
                                drillState[index]?.selected === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  className={`rounded-md border px-3 py-1 text-sm ${
                                    isSelected
                                      ? "border-black bg-black text-white"
                                      : "border-zinc-200 bg-white text-zinc-700"
                                  }`}
                                  onClick={() => {
                                    const isCorrect =
                                      normalize(option) ===
                                      normalize(drill.answer);
                                    setDrillState((prev) => ({
                                      ...prev,
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
                        ) : null}

                        {drill.type === "fill_blank" ? (
                          <div className="mt-3 flex flex-col gap-2">
                            <input
                              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                              value={drillState[index]?.input ?? ""}
                              onChange={(event) =>
                                setDrillState((prev) => ({
                                  ...prev,
                                  [index]: {
                                    input: event.target.value,
                                    selected: undefined,
                                    checked: false,
                                    isCorrect: null,
                                    showAnswer: prev[index]?.showAnswer ?? false,
                                  },
                                }))
                              }
                              placeholder="Type your answer"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-md bg-black px-3 py-1 text-xs font-medium text-white"
                                onClick={() => {
                                  const input =
                                    drillState[index]?.input ?? "";
                                  const isCorrect =
                                    normalize(input) ===
                                    normalize(drill.answer);
                                  setDrillState((prev) => ({
                                    ...prev,
                                    [index]: {
                                      input,
                                      selected: undefined,
                                      checked: true,
                                      isCorrect,
                                      showAnswer: prev[index]?.showAnswer ?? false,
                                    },
                                  }));
                                }}
                              >
                                Check
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700"
                                onClick={() =>
                                  setDrillState((prev) => ({
                                    ...prev,
                                    [index]: {
                                      input: prev[index]?.input ?? "",
                                      selected: undefined,
                                      checked: prev[index]?.checked ?? false,
                                      isCorrect: prev[index]?.isCorrect ?? null,
                                      showAnswer: true,
                                    },
                                  }))
                                }
                              >
                                Show answer
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {drill.type === "rewrite" ? (
                          <div className="mt-3 flex flex-col gap-2">
                            <textarea
                              className="min-h-[120px] rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                              value={drillState[index]?.input ?? ""}
                              onChange={(event) =>
                                setDrillState((prev) => ({
                                  ...prev,
                                  [index]: {
                                    input: event.target.value,
                                    selected: undefined,
                                    checked: false,
                                    isCorrect: null,
                                    showAnswer: prev[index]?.showAnswer ?? false,
                                  },
                                }))
                              }
                              placeholder="Rewrite the sentence"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-md bg-black px-3 py-1 text-xs font-medium text-white"
                                onClick={() => {
                                  const input =
                                    drillState[index]?.input ?? "";
                                  const isCorrect =
                                    normalize(input) ===
                                    normalize(drill.answer);
                                  setDrillState((prev) => ({
                                    ...prev,
                                    [index]: {
                                      input,
                                      selected: undefined,
                                      checked: true,
                                      isCorrect,
                                      showAnswer: prev[index]?.showAnswer ?? false,
                                    },
                                  }));
                                }}
                              >
                                Check
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700"
                                onClick={() =>
                                  setDrillState((prev) => ({
                                    ...prev,
                                    [index]: {
                                      input: prev[index]?.input ?? "",
                                      selected: undefined,
                                      checked: prev[index]?.checked ?? false,
                                      isCorrect: prev[index]?.isCorrect ?? null,
                                      showAnswer: true,
                                    },
                                  }))
                                }
                              >
                                Show answer
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {drillState[index]?.checked ? (
                          <div
                            className={`mt-3 text-xs font-medium ${
                              drillState[index]?.isCorrect
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {drillState[index]?.isCorrect
                              ? "Correct"
                              : "Incorrect"}
                          </div>
                        ) : null}

                        {drillState[index]?.checked ||
                        drillState[index]?.showAnswer ? (
                          <div className="mt-2 text-xs text-zinc-500">
                            Correct answer: {drill.answer}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
        </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
