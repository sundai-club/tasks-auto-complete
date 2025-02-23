import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { pipe, ContentItem, ScreenpipeQueryParams } from "@screenpipe/js";
import { z } from "zod";
import { FormDetector } from "./FormDetector";

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

class WorkflowMonitor {
    private formDetector: FormDetector;
    private userProfile: string;

    constructor(userProfile: string) {
        this.formDetector = new FormDetector();
        this.userProfile = userProfile;
    }

    private deduplicateEntries<T extends { timestamp: string }>(entries: T[], getKey: (entry: T) => string): T[] {
        const uniqueEntries = new Map<string, T>();
        entries.forEach(entry => {
            const key = getKey(entry);
            const existing = uniqueEntries.get(key);
            if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
                uniqueEntries.set(key, entry);
            }
        });
        return Array.from(uniqueEntries.values());
    }

    async generateComputerLog(
        screenData: ContentItem[],
    ): Promise<ComputerLog> {
        console.log("\n=== Raw Screen Data ===");
        console.log("Number of items:", screenData.length);
        console.log("DEBUG: Raw screen data received:", JSON.stringify(screenData, null, 2));
        
        // First, let's extract and deduplicate OCR text
        const rawOcrTexts = screenData
            .filter(item => item.type === 'OCR')
            .map(item => item.content as OCRContent)
            .map(content => ({
                text: content.text,
                timestamp: content.timestamp || new Date().toISOString(),
                appName: content.appName,
                url: content.url || '',
                title: content.title || ''
            }));

        const ocrTexts = this.deduplicateEntries(rawOcrTexts, entry => {
            // Create a key that ignores timestamp
            return JSON.stringify({
                text: entry.text,
                appName: entry.appName,
                url: entry.url,
                title: entry.title
            });
        });

        console.log("\n=== OCR Text Entries ===");
        console.log("Number of raw OCR entries:", rawOcrTexts.length);
        console.log("Number of unique OCR entries:", ocrTexts.length);
        if (ocrTexts.length > 0) {
            console.log("Sample unique OCR texts:", ocrTexts.slice(0, 3).map(entry => ({
                text: entry.text.substring(0, 100) + (entry.text.length > 100 ? '...' : ''),
                appName: entry.appName,
                timestamp: entry.timestamp
            })));
        }

        // Then get and deduplicate UI interactions
        const rawUiActions = screenData
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

        const uiActions = this.deduplicateEntries(rawUiActions, entry => {
            // Create a key that ignores timestamp
            return JSON.stringify({
                action: entry.action,
                elementType: entry.elementType,
                elementText: entry.elementText,
                appName: entry.appName,
                url: entry.url,
                title: entry.title
            });
        });

        console.log("\n=== UI Actions ===");
        console.log("Number of raw UI actions:", rawUiActions.length);
        console.log("Number of unique UI actions:", uiActions.length);
        if (uiActions.length > 0) {
            console.log("Sample unique UI actions:", uiActions.slice(0, 3));
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

    async sendToInbox(title: string, body: string) {
        try {
            await pipe.inbox.send({ title, body });
        } catch (error) {
            console.log("\n=== Inbox Service Error ===");
            console.log(`Could not send message to inbox (${title}): ${error}`);
            console.log("Continuing execution...");
        }
    }

    async streamComputerLogs(onlyChrome: boolean): Promise<void> {
        console.log("starting computer logs stream to markdown");

        const config = {
            interval: 60,
        };
        console.log("loaded config:", JSON.stringify(config, null, 2));

        const interval = config.interval * 1000;
        const lookbackPeriod = 3600 * 1000; // Look back 1 hour instead of just interval seconds

        

        await this.sendToInbox(
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
                    const logEntry = await this.generateComputerLog(allData);
                    console.log("computer log entry:", logEntry);
                    logEntries.push(logEntry);
                    await this.checkForWorkflows(logEntries);
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
                await this.sendToInbox(
                    "computer log error",
                    `error in computer log pipeline: ${error}`
                );
            }

            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }


    async checkForWorkflows(logEntries: ComputerLog[]): Promise<void> {
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
            return;
        }

        const lastFive = allActivities.slice(-5);
        console.log("Number of activities being analyzed:", 
            lastFive.reduce((sum, act) => sum + act.ocrData.length + act.uiData.length, 0));

        const hasEmptyForm = await this.formDetector.detectEmptyForms(lastFive);
        await this.maybeProposeAgentAction(hasEmptyForm);
    }

    async maybeProposeAgentAction(hasEmptyForm: boolean): Promise<String | undefined> {
        if (!hasEmptyForm) {
            return;
        }

        console.log("\nCreating agent action proposal");

        const prompt = `
            You are an intelligent task automation assistant. 
            There is an empty form on a screen, which requires completion. 
            Analyze the screen state to suggest a task automation action.
        `;

        console.log("\n=== Sending to LLM ===");        
        const provider = createOpenAI({apiKey: process.env.OPENAI_API_KEY})("gpt-4");

        const taskSchema = z.object({
            task: z.string().describe('The suggested task automation action'),
            confidence: z.number().min(0).max(1).describe('Confidence level in the suggestion')
        });

        const response = await generateObject({
            model: provider,
            messages: [{ role: "user", content: prompt }],
            schema: taskSchema,
            temperature: 0.7
        });

        console.log("\n=== LLM Response ===");
        console.log("DEBUG: AI response:", response);

        const { task, confidence } = response.object;        
        // Format the task on one line, removing any newlines and extra spaces
        const formattedTask = `TASK (${Math.round(confidence * 100)}% confidence): ${task.replace(/\s+/g, ' ').trim()}`;
        console.log(formattedTask);

        // Use the new sendToInbox function
        await this.sendToInbox("Task Suggestion", formattedTask);
        return task;
    }
}

const profile = `
name: Alexander Ivkin
email: mit@ivkin.dev
`;
const monitor = new WorkflowMonitor(profile);

monitor.streamComputerLogs(true).catch(error => {
    console.error("Error in streamComputerLogs:", error);
});
