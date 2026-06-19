import fs from "fs";
import path from "path";
import type { RuleBankEntry } from "./types";

const RULES_PATH = path.join(process.cwd(), "rules", "rule_bank_v0.json");

const rawRules = fs.readFileSync(RULES_PATH, "utf8");
const parsedRules = JSON.parse(rawRules) as RuleBankEntry[];

export const rules = parsedRules.map((rule) => ({
  ...rule,
  learner_explanation: rule.learner_explanation ?? rule.explanation_es ?? "",
  minimal_correction_policy:
    rule.minimal_correction_policy ??
    "Change only the smallest span needed to repair this grammar pattern.",
  do_not_flag: rule.do_not_flag ?? [],
}));

export const allowedRuleIds = new Set(rules.map((rule) => rule.rule_id));

export const rulesById = new Map(rules.map((rule) => [rule.rule_id, rule]));

export const rulesForPrompt = rules.map((rule) => ({
  rule_id: rule.rule_id,
  title: rule.title,
  category: rule.category,
  subcategory: rule.subcategory,
  learner_explanation: rule.learner_explanation,
  minimal_correction_policy: rule.minimal_correction_policy,
  examples: rule.examples?.slice(0, 2) ?? [],
  do_not_flag: rule.do_not_flag ?? [],
}));
