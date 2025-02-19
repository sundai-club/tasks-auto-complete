import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { pipe, ContentItem, ScreenpipeQueryParams } from "@screenpipe/js";
import { z } from "zod";

interface BaseContent {
    timestamp?: string;
    appName?: string;
    url?: string;
    title?: string;
}

interface OCRContent extends BaseContent {
    text: string;
}

interface UIContent extends BaseContent {
    action?: string;
    elementType?: string;
    elementText?: string;
}

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
    console.log("\n=== Raw Screen Data ===");
    console.log("Number of items:", screenData.length);
    console.log("DEBUG: Raw screen data received:", JSON.stringify(screenData, null, 2));
    
    // First, let's extract all OCR text with context
    const ocrTexts = screenData
        .filter(item => item.type === 'OCR')
        .map(item => item.content as OCRContent)
        .map(content => ({
            text: content.text,
            timestamp: content.timestamp || new Date().toISOString(),
            appName: content.appName,
            url: content.url || '',
            title: content.title || ''
        }));

    console.log("\n=== OCR Text Entries ===");
    console.log("Number of OCR entries:", ocrTexts.length);
    if (ocrTexts.length > 0) {
        console.log("Sample OCR texts:", ocrTexts.slice(0, 3).map(entry => ({
            text: entry.text.substring(0, 100) + (entry.text.length > 100 ? '...' : ''),
            appName: entry.appName,
            timestamp: entry.timestamp
        })));
    }

    // Then get UI interactions
    const uiActions = screenData
        .filter(item => item.type === 'UI')
        .map(item => item.content as UIContent)
        .map(content => ({
            action: content.action || '',
            elementType: content.elementType || '',
            elementText: content.elementText || '',
            timestamp: content.timestamp || new Date().toISOString(),
            appName: content.appName || 'unknown',
            url: content.url || '',
            title: content.title || ''
        }));

    console.log("\n=== UI Actions ===");
    console.log("Number of UI actions:", uiActions.length);
    if (uiActions.length > 0) {
        console.log("Sample UI actions:", uiActions.slice(0, 3));
    }

    // Combine all activities with proper context
    const activityEntries = {
        ocrData: ocrTexts,
        uiData: uiActions,
        summary: {
            totalActivities: ocrTexts.length + uiActions.length,
            timeRange: {
                start: Math.min(...[...ocrTexts, ...uiActions].map(e => new Date(e.timestamp).getTime())),
                end: Math.max(...[...ocrTexts, ...uiActions].map(e => new Date(e.timestamp).getTime()))
            },
            apps: [...new Set([...ocrTexts, ...uiActions].map(e => e.appName))],
            urls: [...new Set([...ocrTexts, ...uiActions].map(e => e.url).filter(Boolean))]
        }
    };

    // Create the log entry with the full activity data
    const logEntry: ComputerLog = {
        platform: "browser",
        identifier: activityEntries.summary.urls[0] || "unknown",
        timestamp: new Date(activityEntries.summary.timeRange.end).toISOString(),
        content: JSON.stringify(activityEntries)
    };

    console.log("\n=== Generated Log Entry ===");
    console.log("Summary:", activityEntries.summary);
    console.log("Sample OCR text:", ocrTexts[0]?.text.substring(0, 100));
    console.log("Sample UI action:", uiActions[0]);

    return logEntry;
}

async function sendToInbox(title: string, body: string) {
    try {
        await pipe.inbox.send({ title, body });
    } catch (error) {
        console.log("\n=== Inbox Service Error ===");
        console.log(`Could not send message to inbox (${title}): ${error}`);
        console.log("Continuing execution...");
    }
}

async function streamComputerLogs(onlyChrome: boolean): Promise<void> {
    console.log("starting computer logs stream to markdown");

    const config = {
        interval: 60,
    };
    console.log("loaded config:", JSON.stringify(config, null, 2));

    const interval = config.interval * 1000;
    const lookbackPeriod = 3600 * 1000; // Look back 1 hour instead of just interval seconds

    await sendToInbox(
        "computer log stream started",
        `monitoring computer work every ${config.interval} seconds, looking back 1 hour`
    );

    let logEntries: ComputerLog[] = [];

    while (true) {
        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - lookbackPeriod);

            console.log("\n=== Querying Screenpipe ===");
            console.log("Time range:", {
                start: oneHourAgo.toISOString(),
                end: now.toISOString()
            });

            // Query both OCR and UI interaction data
            console.log("Querying OCR data...");
            const baseOCRQuery: ScreenpipeQueryParams = {
                startTime: oneHourAgo.toISOString(),
                endTime: now.toISOString(),
                limit: 50,
                contentType: "ocr"
            };
            const ocrData = await pipe.queryScreenpipe(onlyChrome ? { ...baseOCRQuery, appName: "Chrome" } : baseOCRQuery);
            
            console.log("Querying UI data...");
            const baseUIQuery: ScreenpipeQueryParams = {
                startTime: oneHourAgo.toISOString(),
                endTime: now.toISOString(),
                limit: 50,
                contentType: "ui",
            };
            const uiData = await pipe.queryScreenpipe(onlyChrome ? { ...baseUIQuery, appName: "Chrome" } : baseUIQuery);

            console.log("\n=== Raw Query Results ===");
            console.log("OCR data structure:", {
                hasData: !!ocrData,
                dataLength: ocrData?.data?.length || 0,
                isArray: Array.isArray(ocrData?.data),
                keys: ocrData ? Object.keys(ocrData) : [],
                firstItem: ocrData?.data?.[0] ? {
                    type: ocrData.data[0].type,
                    contentKeys: Object.keys(ocrData.data[0].content || {}),
                } : 'no items'
            });
            
            console.log("UI data structure:", {
                hasData: !!uiData,
                dataLength: uiData?.data?.length || 0,
                isArray: Array.isArray(uiData?.data),
                keys: uiData ? Object.keys(uiData) : [],
                firstItem: uiData?.data?.[0] ? {
                    type: uiData.data[0].type,
                    contentKeys: Object.keys(uiData.data[0].content || {}),
                } : 'no items'
            });

            // Combine and sort all data by timestamp
            const allData = [
                ...(ocrData?.data || []),
                ...(uiData?.data || [])
            ].sort((a, b) => {
                const timeA = a.content.timestamp || new Date().toISOString();
                const timeB = b.content.timestamp || new Date().toISOString();
                return timeA.localeCompare(timeB);
            });

            console.log("\n=== Combined Data ===");
            console.log("Total items:", allData.length);
            if (allData.length > 0) {
                console.log("Data types present:", new Set(allData.map(item => item.type)));
                console.log("First item:", JSON.stringify(allData[0], null, 2));
                const logEntry = await generateComputerLog(allData);
                console.log("computer log entry:", logEntry);
                logEntries.push(logEntry);
                await maybeProposeAgentAction(logEntries);
            } else {
                console.log("no relevant user activity detected in the last hour");
                
                // Debug why we might not be getting data
                console.log("\n=== Debug Info ===");
                console.log("OCR Query params:", {
                    startTime: oneHourAgo.toISOString(),
                    endTime: now.toISOString(),
                    limit: 50,
                    contentType: "ocr"
                });
                console.log("UI Query params:", {
                    startTime: oneHourAgo.toISOString(),
                    endTime: now.toISOString(),
                    limit: 50,
                    contentType: "ui"
                });
            }
        } catch (error) {
            console.error("\n=== Error in Pipeline ===");
            console.error("Error details:", error);
            await sendToInbox(
                "computer log error",
                `error in computer log pipeline: ${error}`
            );
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}


async function maybeProposeAgentAction(logEntries: ComputerLog[]): Promise<String | undefined> {
    console.log("\n=== Analyzing Log Entries ===");
    console.log("Number of entries:", logEntries.length);

    // Parse and combine all activity data
    const allActivities = logEntries.map(entry => {
        try {
            return JSON.parse(entry.content);
        } catch (e) {
            console.log("Failed to parse entry:", entry);
            return null;
        }
    }).filter(Boolean);

    if (allActivities.length === 0) {
        console.log("No valid activity data found");
        return "No activity data available for analysis";
    }

    const prompt = `
    You are an intelligent task automation assistant. Analyze the following computer activities to identify patterns and suggest automations.
    
    Recent computer activities:
    ${JSON.stringify(allActivities, null, 2)}

    The data includes:
    1. OCR Text: Text captured from the screen, showing what the user is reading or interacting with
    2. UI Actions: User interactions like clicks, typing, and navigation
    3. Context: URLs, application names, and timestamps for each action

    Your task:
    1. Analyze the OCR text and UI actions to understand what tasks the user is performing
    2. Look for patterns or repetitive actions that could be automated
    3. Consider the sequence and timing of actions
    4. Identify any workflows that could be streamlined

    If you find potential automation opportunities:
    1. Describe the pattern you've identified
    2. Explain why it would be valuable to automate
    3. Provide specific steps for automation
    4. Include relevant UI elements and URLs
    5. Specify any prerequisites

    Focus on patterns like:
    - Repeated data entry or form filling
    - Regular checking of specific information
    - Common sequences of actions
    - Time-consuming manual processes
    - Frequent application or page switching

    Format your response as a JSON object with:
    - platform: The main application involved
    - identifier: Specific URL or context where the pattern occurs
    - timestamp: When this pattern was last observed
    - content: Detailed description of the pattern and automation suggestion
    `;

    console.log("\n=== Sending to LLM ===");
    console.log("Number of activities being analyzed:", 
        allActivities.reduce((sum, act) => sum + act.ocrData.length + act.uiData.length, 0));

    const provider = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })("gpt-4o-mini");

    const response = await generateObject({
        model: provider,
        messages: [{ role: "user", content: prompt }],
        schema: computerLog,
    });

    console.log("\n=== LLM Response ===");
    console.log("DEBUG: AI response:", response);

    // Extract the content field from the response and format it
    const content = response.object.content;
    const taskContent = content.includes('"content":') 
        ? JSON.parse(content).content 
        : content;
    
    // Format the task on one line, removing any newlines and extra spaces
    const formattedTask = `TASK: ${taskContent.replace(/\s+/g, ' ').trim()}`;

    console.log(formattedTask);

    // Use the new sendToInbox function
    await sendToInbox("Task Suggestion", formattedTask);

    return response.object.content;
}


streamComputerLogs(true).catch(error => {
    console.error("Error in streamComputerLogs:", error);
});
