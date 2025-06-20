import * as readline from "readline";

// Create a single shared readline interface
export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to ask a question using the shared interface
export function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function to close the terminal gracefully
export function closeTerminal(): void {
  rl.close();
}

// Handle process exit
rl.on("close", () => {
  console.log("👋 Goodbye!");
  process.exit(0);
});
