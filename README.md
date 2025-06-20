# Sales Prospect Automation POC

A TypeScript-based proof of concept for automating cold prospect outreach using AI-powered message generation and state machine workflow management.

## Features

- **AI-Powered Message Generation**: Automated creation of warm-up, contextual, and follow-up messages using OpenAI
- **State Machine Workflow**: XState-powered prospect management through different engagement stages
- **Intelligent Response Classification**: Automatic categorization of prospect responses (positive, negative, business interest, no response)
- **Follow-up Management**: Automated follow-up scheduling with configurable attempt limits
- **Interactive Chat Interface**: Command-line interface with Steve, your AI sales assistant

## Prerequisites

- Node.js (v16+)
- OpenAI API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Usage

Start the application:

```bash
npm start
```

The system will launch an interactive chat with Steve, your AI sales assistant, who will guide you through the prospect outreach workflow.

## Workflow States

1. **Generate Warmup** - Create initial outreach message
2. **Collect Feedback** - Process prospect responses
3. **Generate Contextual** - Create follow-up messages based on positive responses
4. **Generate Follow-up** - Handle non-responsive prospects (max 3 attempts)
5. **Move to Stage 1** - Advance interested prospects
6. **Archive** - Handle unresponsive or negative prospects

## Technologies

- **TypeScript** - Type-safe development
- **XState** - State machine management
- **OpenAI API** - AI message generation and response classification
- **Node.js** - Runtime environment
