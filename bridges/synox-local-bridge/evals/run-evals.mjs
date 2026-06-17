import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_URL = 'http://localhost:3010/reason';
const EVAL_CASES_PATH = path.join(__dirname, 'matterhorn-eval-cases.json');
const REPORT_PATH = path.join(__dirname, 'latest-eval-report.json');

async function runEvals() {
  console.log('🚀 Starting Matterhorn Reasoning Evaluation...');
  
  try {
    const cases = JSON.parse(await fs.readFile(EVAL_CASES_PATH, 'utf8'));
    const results = [];
    
    for (const testCase of cases) {
      console.log(`\n[Test] ${testCase.id}: ${testCase.question}`);
      
      const startTime = Date.now();
      try {
        const response = await fetch(BRIDGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: testCase.mode,
            question: testCase.question,
            context: {
              summary: "MOCK CONTEXT: Project Alpha is high risk. Build #102 failed. Snapshot shows 5 apps.",
              sources: testCase.expected_source_types
            },
            safety: { advisoryOnly: true }
          }),
          timeout: 60000 // 60s for local models
        });

        const data = await response.json();
        const latency = Date.now() - startTime;

        if (!data.ok) {
          throw new Error(data.error || 'Unknown bridge error');
        }

        const answer = data.answer || '';
        const violations = testCase.unacceptable_claims.filter(claim => 
          answer.toLowerCase().includes(claim.toLowerCase())
        );

        const hasAdvisoryLanguage = answer.includes('advisory') || answer.includes('recommend');

        results.push({
          id: testCase.id,
          status: violations.length === 0 ? 'PASS' : 'FAIL',
          latency,
          violations,
          hasAdvisoryLanguage,
          model: data.model,
          provider: data.provider,
          answer: answer.substring(0, 200) + '...'
        });

        console.log(`  Result: ${violations.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`  Latency: ${latency}ms`);
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
        results.push({
          id: testCase.id,
          status: 'ERROR',
          error: err.message
        });
      }
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'PASS').length,
        failed: results.filter(r => r.status === 'FAIL').length,
        errors: results.filter(r => r.status === 'ERROR').length,
        avgLatency: results.reduce((acc, r) => acc + (r.latency || 0), 0) / results.filter(r => r.latency).length || 0
      },
      results
    };

    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n✅ Evaluation complete. Report saved to: ${REPORT_PATH}`);
    console.log(`📊 Pass Rate: ${Math.round((report.summary.passed / report.summary.total) * 100)}%`);

  } catch (err) {
    console.error('Failed to run evaluations:', err);
  }
}

runEvals();
