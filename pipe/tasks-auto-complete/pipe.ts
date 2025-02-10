import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { pipe, ContentItem, OCRContent } from "@screenpipe/js";

const computerLog = z.object({
    platform: z.string(),
    identifier: z.string(),
    timestamp: z.string(),
    content: z.string(),
});

type ComputerLog = z.infer<typeof computerLog>;

async function generateComputerLog(
    screenData: ContentItem[],
): Promise<ComputerLog> {
    console.log("DEBUG: Raw screen data received:", JSON.stringify(screenData, null, 2));

    // Extract text content from OCR data
    const textEntries = screenData
        .filter(item => item.type === 'OCR' && item.content && 'text' in item.content)
        .map(item => {
            const ocrContent = item.content as OCRContent;
            return {
                platform: 'screen',
                identifier: ocrContent.windowName || 'unknown',
                timestamp: new Date().toISOString(),
                content: ocrContent.text.trim()
            };
        })
        .filter(entry => entry.content !== '');

    console.log("DEBUG: Extracted text entries:", JSON.stringify(textEntries, null, 2));

    if (textEntries.length === 0) {
        return {
            platform: 'screen',
            identifier: 'ocr',
            timestamp: new Date().toISOString(),
            content: 'No relevant text detected'
        };
    }

    // Combine all text entries into a single log entry
    const combinedEntry = {
        platform: 'screen',
        identifier: 'ocr',
        timestamp: new Date().toISOString(),
        content: textEntries.map(entry => entry.content).join('\n')
    };

    console.log("DEBUG: Combined log entry:", JSON.stringify(combinedEntry, null, 2));
    return combinedEntry;
}

async function streamComputerLogsToMarkdown(): Promise<void> {
    console.log("starting computer logs stream to markdown");

    const config = {
        interval: 60,
    }
    console.log("loaded config:", JSON.stringify(config, null, 2));

    const interval = config.interval * 1000;

    pipe.inbox.send({
        title: "computer log stream started",
        body: `monitoring computer work every ${config.interval} seconds`,
    });

    let logEntries: ComputerLog[] = [];

    while (true) {
        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - interval);

            console.log("DEBUG: Querying screen data from", oneHourAgo.toISOString(), "to", now.toISOString());

            const screenData = await pipe.queryScreenpipe({
                startTime: oneHourAgo.toISOString(),
                endTime: now.toISOString(),
                limit: 50,
                contentType: "ocr",
            });

            console.log("DEBUG: Query response:", JSON.stringify({
                hasData: !!screenData,
                dataLength: screenData?.data?.length || 0,
                timeRange: {
                    start: oneHourAgo.toISOString(),
                    end: now.toISOString()
                }
            }, null, 2));

            if (screenData && screenData.data.length > 0) {
                const logEntry = await generateComputerLog(
                    screenData.data
                );
                console.log("DEBUG: Generated log entry:", JSON.stringify(logEntry, null, 2));
                logEntries.push(logEntry);
                await maybeProposeAgentAction(logEntries);
            } else {
                console.log("no relevant computer work detected in the last hour");
            }
        } catch (error) {
            console.error("error in computer log pipeline:", error);
            await pipe.inbox.send({
                title: "computer log error",
                body: `error in computer log pipeline: ${error}`,
            });
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}

async function maybeProposeAgentAction(logEntries: ComputerLog[]): Promise<String | undefined> {
    console.log("DEBUG: Proposing agent action for log entries:", JSON.stringify(logEntries, null, 2));

    const taskSchema = z.object({
        task: z.string()
    });

    // Get the most recent log entry's content
    const latestContent = logEntries[logEntries.length - 1].content;
    console.log("DEBUG: Latest content being sent to LLM:", latestContent);

    const prompt = `
    You are an AI assistant analyzing computer screen content to suggest helpful next actions.
    
    Recent screen activity history:
    ${logEntries.slice(-5).map(entry => `[${entry.timestamp}] ${entry.content}`).join('\n')}

    Based on this activity history, suggest a specific, actionable next step or task that would be helpful.
    Focus on practical, immediate actions that would be most helpful given the current context.
    
    Rules:
    1. Your suggestion must be directly related to the actual content shown in the activity history
    2. Do not suggest generic tasks or use example tasks
    3. If you cannot derive a specific actionable task from the content, respond with "TASK: Continue monitoring for actionable content"
    4. The task must be something concrete that can be done right now
    5. Include relevant details from the screen content in your task

    Format your response as a clear, direct task suggestion starting with "TASK:".
    `;

    const provider = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })("gpt-4o-mini");

    const response = await generateObject({
        model: provider,
        messages: [{ role: "user", content: prompt }],
        schema: taskSchema,
    });

    console.log("DEBUG: AI response:", response);

    const taskResponse = response.object.task;
    const formattedTask = taskResponse.startsWith("TASK:") ? taskResponse : `TASK: ${taskResponse}`;

    console.log("DEBUG: Generated task:", formattedTask);

    // Send the task to the inbox
    await pipe.inbox.send({
        title: "Task Suggestion",
        body: formattedTask,
    });

    return formattedTask;
}

streamComputerLogsToMarkdown();

/*

Instructions to run this pipe:

1. install dependencies:
    ```
    cd pipe/tasks-auto-complete
    npm i ai @ai-sdk/openai @screenpipe/js zod
    ```

2. set environment variables:
   ```
   export OPENAI_API_KEY=your_openai_api_key
   ```

3. run the pipe:
   ```
   screenpipe pipe install pipe/tasks-auto-complete
   screenpipe pipe enable tasks-auto-complete
   screenpipe 
   ```

*/