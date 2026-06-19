export const modelAnalyzeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["errors", "corrected_text", "unmapped"],
  properties: {
    errors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "span",
          "category",
          "rule_id",
          "severity",
          "correction",
          "confidence",
        ],
        properties: {
          span: {
            type: "object",
            additionalProperties: false,
            required: ["text"],
            properties: {
              text: { type: "string" },
            },
          },
          category: { type: "string" },
          rule_id: { type: "string" },
          severity: { type: "number" },
          correction: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    corrected_text: { type: "string" },
    unmapped: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["span_text", "reason", "suggestion"],
        properties: {
          span_text: { type: "string" },
          reason: { type: "string" },
          suggestion: { type: "string" },
        },
      },
    },
  },
} as const;
