import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { pipe, ContentItem } from "@screenpipe/js";

const engineeringLog = z.object({
    platform: z.string(),
    identifier: z.string(),
    timestamp: z.string(),
    content: z.string(),
});

type EngineeringLog = z.infer<typeof engineeringLog>;

async function generateEngineeringLog(
    screenData: ContentItem[],
): Promise<EngineeringLog> {    
    const filteredBrowserOnly = screenData.filter((item) => {
        return (item.type == 'OCR' || item.type == 'UI') && (item.content.appName === "Chrome" || item.content.appName === "Firefox");
    });
    const prompt = `You are provided with screen data extracted from various applications:
  <screen_data>
  ${JSON.stringify(filteredBrowserOnly)}
  </screen_data>
  
  Your task is to extract only browser interactions and analyze if this user alrady performed silimar action in the past.
  If they did, you should suggest the next action they should take.
  
  For each message found, generate a JSON object with this structure:
  
  {    
    "platform": "whatsapp",
    "identifier": "+1234567890",
    "timestamp": "2024-03-21T15:30:00Z",
    "content": "See you tomorrow at the meeting"
  }

  the action is the detailed step by step plan to perform this action.
  
  **Important Rules**:
  - Only process Browser interactions
  - Ensure timestamps are in ISO format
  - Exclude any non-messaging content
  
  **Example Output**:
  [
    {
      "platform": "whatsapp",
      "identifier": "+1234567890",
      "timestamp": "2024-03-21T15:30:00Z",
      "content": "See you tomorrow at the meeting"
    },
    {
      "platform": "discord",
      "identifier": "user#1234",
      "timestamp": "2024-03-21T15:31:00Z",
      "content": "I'll be there!"
    }
 ]
  Analyze the screen data and provide only the most recent messages matching these criteria.`;

    const provider = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })("gpt-4o");

    const response = await generateObject({
        model: provider,
        messages: [{ role: "user", content: prompt }],
        schema: engineeringLog,
    });

    console.log("ai answer:", response);

    return response.object;
}


async function streamEngineeringLogsToMarkdown(): Promise<void> {
    console.log("starting engineering logs stream to markdown");

    const config = {
        interval: 60,
    }
    console.log("loaded config:", JSON.stringify(config, null, 2));

    const interval = config.interval * 1000;

    pipe.inbox.send({
        title: "engineering log stream started",
        body: `monitoring engineering work every ${config.interval} seconds`,
    });    

    let logEntries: EngineeringLog[] = [];

    while (true) {
        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - interval);

            const screenData = await pipe.queryScreenpipe({
                startTime: oneHourAgo.toISOString(),
                endTime: now.toISOString(),
                limit: 50,
                contentType: "ocr",
            });

            if (screenData && screenData.data.length > 0) {
                const logEntry = await generateEngineeringLog(
                    screenData.data
                );
                console.log("engineering log entry:", logEntry);
                logEntries.push(logEntry);
                await maybeProposeAgentAction(logEntries);
            } else {
                console.log("no relevant engineering work detected in the last hour");
            }
        } catch (error) {
            console.error("error in engineering log pipeline:", error);
            await pipe.inbox.send({
                title: "engineering log error",
                body: `error in engineering log pipeline: ${error}`,
            });
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}


async function maybeProposeAgentAction(logEntry: EngineeringLog[]): Promise<String | undefined> {
    console.log("proposing agent action for log entry:", logEntry);

    const prompt = `
    You are provided with an engineering log entries    
    ${JSON.stringify(logEntry)}

    Your task is to analyze the log entries and propose the next action that the user should take.
    The action is the detailed step by step plan to perform this action.

    **Example Output**:
    "The user should click on the 'Confirm' button to complete the transaction."
    `;


    const provider = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })("gpt-4o");

    const response = await generateObject({
        model: provider,
        messages: [{ role: "user", content: prompt }],
        schema: engineeringLog,
    });

    console.log("ai answer:", response);

    return response.object.content;
}


streamEngineeringLogsToMarkdown();

/*

Instructions to run this pipe:

1. install screenpipe and git clone this repo
    ```
    git clone https://github.com/mediar-ai/screenpipe.git
    cd screenpipe
    ```

2. install dependencies:
    ```
    cd pipe/tasks-auto-complete
    npm i ai @ai-sdk/openai @screenpipe/js zod
    ```

3. set environment variables:
   ```
   export OPENAI_API_KEY=your_openai_api_key
   ```

4. run the pipe:
   ```
   screenpipe pipe install pipe/tasks-auto-complete
   screenpipe pipe enable tasks-auto-complete
   screenpipe 
   ```

*/