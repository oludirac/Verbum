export type Span = {
  start: number;
  end: number;
  text: string;
};

export type AnalyzeRequestBody = {
  text: string;
  previous_errors?: PreviousError[];
  previous_grammar_score?: number;
};

export type PreviousError = {
  rule_id: string;
  span_text: string;
  correction: string;
};

export type ModelAnalyzeError = {
  span: { text: string };
  category: string;
  rule_id: string;
  severity: number;
  correction: string;
  confidence: number;
};

export type ModelUnmappedIssue = {
  span_text: string;
  reason: string;
  suggestion: string;
};

export type ModelAnalyzeResponse = {
  errors: ModelAnalyzeError[];
  corrected_text: string;
  unmapped: ModelUnmappedIssue[];
};

export type AnalyzeError = {
  span: Span;
  category: string;
  rule_id: string;
  severity: number;
  correction: string;
  confidence: number;
};

export type UnmappedIssue = {
  span?: Partial<Span>;
  text?: string;
  correction?: string;
  reason: string;
  suggestion?: string;
  rule_id?: string;
};

export type CategoryStats = {
  category: string;
  subcategory: string;
  count: number;
};

export type DrillType =
  | "rewrite"
  | "fill_blank"
  | "multiple_choice"
  | "spot_error"
  | "explain_choice";

export type DrillTemplate = {
  type: DrillType;
  prompt: string;
  answer: string;
  options?: string[];
};

export type GeneratedDrill = {
  rule_id: string;
  type: DrillType;
  prompt: string;
  answer: string;
  options?: string[];
};

export type RuleBankEntry = {
  rule_id: string;
  category: string;
  subcategory: string;
  rule_type?: string;
  title: string;
  learner_explanation?: string;
  explanation_es?: string;
  minimal_correction_policy?: string;
  examples: Array<{ bad: string; good: string }>;
  do_not_flag?: string[];
  drill_templates: DrillTemplate[];
};

export type RewriteComparison = {
  previous_error_count: number;
  current_error_count: number;
  fixed_rule_ids: string[];
  remaining_rule_ids: string[];
  new_rule_ids: string[];
  score_delta: number;
};

export type AnalyzeResponse = {
  errors: AnalyzeError[];
  corrected_text: string;
  unmapped: UnmappedIssue[];
  drills: GeneratedDrill[];
  category_stats: CategoryStats[];
  grammar_score: number;
  analysis_status: "ok" | "degraded";
  comparison?: RewriteComparison;
};

export type AnalyzeOptions = {
  apiKey: string;
  model?: string;
};
