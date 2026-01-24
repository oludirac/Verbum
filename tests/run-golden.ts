/**
 * Golden Test Runner for Verbum
 * 
 * Run with: npx ts-node tests/run-golden.ts
 * 
 * Requires the dev server to be running on localhost:3000
 */

import goldenTests from './golden.json';

const API_URL = process.env.API_URL || 'http://localhost:3000/api/analyze';

type TestCase = {
  id: string;
  input: string;
  expected_errors?: Array<{
    span_text: string;
    rule_id: string;
    correction?: string;
  }>;
  expected_corrected?: string;
  expected_min_errors?: number;
  notes?: string;
};

type AnalyzeResponse = {
  grammar_score: number;
  errors: Array<{
    span: { text: string };
    rule_id: string;
    correction: string;
  }>;
  corrected_text: string;
};

async function runTest(testCase: TestCase): Promise<{ pass: boolean; details: string }> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testCase.input }),
    });

    if (!response.ok) {
      return { pass: false, details: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as AnalyzeResponse;
    const issues: string[] = [];

    // Check minimum error count
    if (testCase.expected_min_errors !== undefined) {
      if (data.errors.length < testCase.expected_min_errors) {
        issues.push(`Expected at least ${testCase.expected_min_errors} errors, got ${data.errors.length}`);
      }
    }

    // Check specific expected errors
    if (testCase.expected_errors) {
      for (const expected of testCase.expected_errors) {
        const found = data.errors.find(
          (e) => e.span.text === expected.span_text || 
                 e.span.text.includes(expected.span_text) ||
                 expected.span_text.includes(e.span.text)
        );
        
        if (!found) {
          issues.push(`Missing error for "${expected.span_text}"`);
        } else if (expected.rule_id && found.rule_id !== expected.rule_id) {
          issues.push(`Wrong rule for "${expected.span_text}": expected ${expected.rule_id}, got ${found.rule_id}`);
        }
      }

      // Check for unexpected errors when expecting none
      if (testCase.expected_errors.length === 0 && data.errors.length > 0) {
        issues.push(`Expected no errors, got ${data.errors.length}`);
      }
    }

    // Check corrected text (flexible match)
    if (testCase.expected_corrected) {
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      if (normalize(data.corrected_text) !== normalize(testCase.expected_corrected)) {
        issues.push(`Corrected text mismatch`);
      }
    }

    if (issues.length === 0) {
      return { pass: true, details: `✓ ${data.errors.length} errors detected` };
    } else {
      return { pass: false, details: issues.join('; ') };
    }
  } catch (error) {
    return { pass: false, details: `Error: ${error}` };
  }
}

async function main() {
  console.log('Verbum Golden Test Runner\n');
  console.log(`API: ${API_URL}\n`);
  console.log('='.repeat(60) + '\n');

  const testCases = goldenTests.test_cases as TestCase[];
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    const status = result.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`[${status}] ${testCase.id}`);
    console.log(`  Input: "${testCase.input}"`);
    console.log(`  ${result.details}`);
    console.log();

    if (result.pass) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
  
  process.exit(failed > 0 ? 1 : 0);
}

main();
