import { rulesById } from "./rules";
import type { AnalyzeError, GeneratedDrill } from "./types";

const fillTemplate = (value: string, error: AnalyzeError) =>
  value
    .replaceAll("{{bad}}", error.span.text)
    .replaceAll("{{good}}", error.correction);

export const generateDrillsFromErrors = (
  errors: AnalyzeError[]
): GeneratedDrill[] => {
  const drills: GeneratedDrill[] = [];
  const usedTemplates = new Set<string>();

  for (const error of errors) {
    const rule = rulesById.get(error.rule_id);
    if (!rule?.drill_templates?.length) {
      continue;
    }

    const template =
      rule.drill_templates.find(
        (candidate) =>
          !usedTemplates.has(`${error.rule_id}:${candidate.type}:${candidate.prompt}`)
      ) ?? rule.drill_templates[0];

    usedTemplates.add(`${error.rule_id}:${template.type}:${template.prompt}`);
    drills.push({
      rule_id: error.rule_id,
      type: template.type,
      prompt: fillTemplate(template.prompt, error),
      answer: fillTemplate(template.answer, error),
      options: template.options,
    });
  }

  return drills.slice(0, 5);
};
