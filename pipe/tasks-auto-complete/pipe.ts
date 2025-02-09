// import { Client } from "@notionhq/client";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { generateObject } from "ai";
import { createOllama } from "ollama-ai-provider";
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
    ollamaModel: string,
    ollamaApiUrl: string
): Promise<EngineeringLog> {
    // const prompt = `Based on the following screen data, generate a concise engineering log entry:

    //   ${JSON.stringify(screenData)}

    //   Focus only on engineering work. Ignore non-work related activities.
    //   Return a JSON object with the following structure:
    //   {
    //       "title": "Brief title of the engineering task",
    //       "description": "Concise description of the engineering work done",
    //       "tags": ["tag1", "tag2", "tag3"]
    //   }
    //   Provide 1-3 relevant tags related to the engineering work.`;
    console.log("screen data:", JSON.stringify(screenData, null, 2));
    const prompt = `You are provided with screen data extracted from various applications:
  <screen_data>
  ${JSON.stringify(screenData)}
  </screen_data>
  
  Your task is to extract ONLY the most recent three messages from WhatsApp and Discord conversations. Ignore all other applications and content.
  
  For each message found, generate a JSON object with this structure:
  
  {
    "platform": "whatsapp|discord",
    "identifier": "Contact name or phone number",
    "timestamp": "ISO timestamp of the message",
    "content": "The actual message content"
  }
  
  **Important Rules**:
  - Only process WhatsApp and Discord messages
  - Only capture the most recent message from each conversation
  - For WhatsApp, use phone numbers as identifier when available
  - For Discord, use the username/handle as identifier
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

    // const provider = createOllama({ baseURL: ollamaApiUrl });
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

// async function syncLogToNotion(
//   logEntry: EngineeringLog,
//   notion: Client,
//   databaseId: string
// ): Promise<void> {
//   try {
//     console.log("syncLogToNotion", logEntry);
//     await notion.pages.create({
//       parent: { database_id: databaseId },
//       properties: {
//         Title: { title: [{ text: { content: logEntry.title } }] },
//         Description: {
//           rich_text: [{ text: { content: logEntry.description } }],
//         },
//         Tags: { multi_select: logEntry.tags.map((tag) => ({ name: tag })) },
//         Date: { date: { start: new Date().toISOString() } },
//       },
//     });

//     console.log("engineering log synced to notion successfully");

//     // Create markdown table for inbox
//     const markdownTable = `
// | Title | Description | Tags |
// |-------|-------------|------|
// | ${logEntry.title} | ${logEntry.description} | ${logEntry.tags.join(", ")} |
//     `.trim();

//     await pipe.inbox.send({
//       title: "engineering log synced",
//       body: `new engineering log entry:\n\n${markdownTable}`,
//     });
//   } catch (error) {
//     console.error("error syncing engineering log to notion:", error);
//     await pipe.inbox.send({
//       title: "engineering log error",
//       body: `error syncing engineering log to notion: ${error}`,
//     });
//   }
// }
async function writeLogToMarkdown(logEntry: EngineeringLog): Promise<void> {
    try {
        const outputDir = "./engineering-logs";
        const fileName = `log-${new Date().toISOString().split('T')[0]}.md`;
        const filePath = path.join(outputDir, fileName);

        // Create directory if it doesn't exist
        await fs.mkdir(outputDir, { recursive: true });

        const jsonContent = JSON.stringify(logEntry, null, 2);
        const content = `\n${jsonContent}\n\n---\n`;

        // Append to file
        await fs.appendFile(filePath, content, "utf-8");

        console.log("engineering log written to markdown file:", filePath);

        await pipe.inbox.send({
            title: "engineering log saved",
            body: `new engineering log entry saved to ${filePath}`,
        });
    } catch (error) {
        console.error("error writing engineering log to markdown:", error);
        await pipe.inbox.send({
            title: "engineering log error",
            body: `error writing engineering log to markdown: ${error}`,
        });
    }
}


// function streamEngineeringLogsToNotion(): void {
//   console.log("starting engineering logs stream to notion");

//   const config = pipe.loadPipeConfig();
//   console.log("loaded config:", JSON.stringify(config, null, 2));

//   const interval = config.interval * 1000;
//   const databaseId = config.notionDatabaseId;
//   const apiKey = config.notionApiKey;
//   const ollamaApiUrl = config.ollamaApiUrl;
//   const ollamaModel = config.ollamaModel;

//   const notion = new Client({ auth: apiKey });

//   pipe.inbox.send({
//     title: "engineering log stream started",
//     body: `monitoring engineering work every ${config.interval} seconds`,
//   });

//   pipe.scheduler
//     .task("generateEngineeringLog")
//     .every(interval)
//     .do(async () => {
//       try {
//         const now = new Date();
//         const oneHourAgo = new Date(now.getTime() - interval);

//         const screenData = await pipe.queryScreenpipe({
//           startTime: oneHourAgo.toISOString(),
//           endTime: now.toISOString(),
//           limit: 50,
//           contentType: "ocr",
//         });

//         if (screenData && screenData.data.length > 0) {
//           const logEntry = await generateEngineeringLog(
//             screenData.data,
//             ollamaModel,
//             ollamaApiUrl
//           );
//           await syncLogToNotion(logEntry, notion, databaseId);
//         } else {
//           console.log("no relevant engineering work detected in the last hour");
//         }
//       } catch (error) {
//         console.error("error in engineering log pipeline:", error);
//         await pipe.inbox.send({
//           title: "engineering log error",
//           body: `error in engineering log pipeline: ${error}`,
//         });
//       }
//     });

//   pipe.scheduler.start();
// }

function streamEngineeringLogsToMarkdown(): void {
    console.log("starting engineering logs stream to markdown");

    const config = pipe.loadPipeConfig();
    console.log("loaded config:", JSON.stringify(config, null, 2));

    const interval = config.interval * 1000;
    const ollamaApiUrl = config.ollamaApiUrl;
    const ollamaModel = config.ollamaModel;

    pipe.inbox.send({
        title: "engineering log stream started",
        body: `monitoring engineering work every ${config.interval} seconds`,
    });

    pipe.scheduler
        .task("generateEngineeringLog")
        .every(interval)
        .do(async () => {
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
                        screenData.data,
                        ollamaModel,
                        ollamaApiUrl
                    );
                    await writeLogToMarkdown(logEntry);
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
        });

    pipe.scheduler.start();
}


streamEngineeringLogsToMarkdown();

/*

Instructions to run this pipe:

1. install screenpipe and git clone this repo
    ```
    git clone https://github.com/mediar-ai/screenpipe.git
    cd screenpipe
    ```

2. install and run ollama:
   - follow instructions at https://github.com/jmorganca/ollama
   - run `ollama run phi3.5:3.8b-mini-instruct-q4_K_M`

3. set up notion:
   - create a notion integration: https://www.notion.so/my-integrations - copy the API key
   - create a database with properties: Title (text), Description (text), Tags (multi-select), Date (date)
   - share database with your integration - copy the database ID eg https://www.notion.so/<THIS>?<NOTTHIS>

4. set environment variables:
   ```
   export SCREENPIPE_NOTION_API_KEY=your_notion_api_key
   export SCREENPIPE_NOTION_DATABASE_ID=your_notion_database_id
   ```

5. run the pipe:
   ```
   screenpipe pipe download ./examples/typescript/pipe-screen-to-crm
   screenpipe pipe enable screen-to-crm
   screenpipe 
   ```

*/