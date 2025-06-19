import * as dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
