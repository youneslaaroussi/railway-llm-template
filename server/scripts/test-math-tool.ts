import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AgentService } from '../src/agent/agent.service';

async function testMathTool() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const agentService = app.get(AgentService);

  console.log('Testing Math Tool Safety and Functionality\n');

  // Test cases
  const testCases = [
    // Valid expressions
    { expression: '2 + 3', expected: 5, description: 'Simple addition' },
    { expression: '10 - 5', expected: 5, description: 'Simple subtraction' },
    { expression: '4 * 6', expected: 24, description: 'Simple multiplication' },
    { expression: '20 / 4', expected: 5, description: 'Simple division' },
    { expression: '17 % 5', expected: 2, description: 'Modulo operation' },
    { expression: '(2 + 3) * 4', expected: 20, description: 'Parentheses grouping' },
    { expression: '2 + 3 * 4', expected: 14, description: 'Order of operations' },
    { expression: '100 / (2 + 3)', expected: 20, description: 'Complex parentheses' },
    
    // Invalid/dangerous expressions (should fail)
    { expression: 'function()', expected: 'error', description: 'Function call attempt' },
    { expression: 'eval(alert("test"))', expected: 'error', description: 'Eval injection attempt' },
    { expression: 'process.exit()', expected: 'error', description: 'Process access attempt' },
    { expression: 'require("fs")', expected: 'error', description: 'Module require attempt' },
    { expression: 'console.log("test")', expected: 'error', description: 'Console access attempt' },
    { expression: 'x = 5', expected: 'error', description: 'Variable assignment' },
    { expression: '2 + abc', expected: 'error', description: 'Undefined variable' },
    { expression: '10 / 0', expected: 'error', description: 'Division by zero' },
    { expression: '((2 + 3)', expected: 'error', description: 'Unbalanced parentheses' },
    { expression: '2 + 3)', expected: 'error', description: 'Unbalanced parentheses 2' },
    { expression: '2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20 + 21 + 22 + 23 + 24 + 25 + 26 + 27 + 28 + 29 + 30 + 31 + 32 + 33 + 34 + 35 + 36 + 37 + 38 + 39 + 40 + 41 + 42 + 43 + 44 + 45 + 46 + 47 + 48 + 49 + 50 + 51 + 52 + 53 + 54 + 55 + 56 + 57 + 58 + 59 + 60', expected: 'error', description: 'Expression too long' },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const request = {
        message: `Calculate: ${testCase.expression}`,
        conversationHistory: [],
      };

      // Test with the agent
      const response = await agentService.processRequest(request);
      
      // Check if the response contains the expected result or error
      const responseText = response.message.toLowerCase();
      const isError = responseText.includes('error') || responseText.includes('invalid') || responseText.includes('dangerous');
      
      if (testCase.expected === 'error') {
        if (isError) {
          console.log(`✅ ${testCase.description}: Correctly rejected dangerous expression`);
          passed++;
        } else {
          console.log(`❌ ${testCase.description}: Should have been rejected but wasn't`);
          failed++;
        }
      } else {
        if (!isError && responseText.includes(testCase.expected.toString())) {
          console.log(`✅ ${testCase.description}: ${testCase.expression} = ${testCase.expected}`);
          passed++;
        } else {
          console.log(`❌ ${testCase.description}: Expected ${testCase.expected} but got: ${response.message}`);
          failed++;
        }
      }
    } catch (error) {
      if (testCase.expected === 'error') {
        console.log(`✅ ${testCase.description}: Correctly threw error`);
        passed++;
      } else {
        console.log(`❌ ${testCase.description}: Unexpected error: ${error.message}`);
        failed++;
      }
    }
  }

  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Math tool is working correctly and safely.');
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
  }

  await app.close();
}

// Run the test
testMathTool().catch(console.error); 