import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { pipe, ContentItem, ScreenpipeQueryParams } from "@screenpipe/js";
import { z } from "zod";
import { FormDetector } from "./FormDetector";
import * as fs from 'fs';
import * as path from 'path';

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

interface UrlState {
    lastChecked: string;  // timestamp
    lastContent: string;  // hash or representation of the page content
}

class WorkflowMonitor {
    private formDetector: FormDetector;
    private userProfile: string;
    private analyzedUrls: Map<string, UrlState>;
    private readonly profilePath: string;

    constructor(userProfile: string) {
        this.formDetector = new FormDetector();
        this.userProfile = userProfile;
        this.analyzedUrls = new Map();
        this.profilePath = path.join(require('os').tmpdir(), 'tasks-auto-complete-profile.txt');
    }

    private async reloadProfile(): Promise<void> {
        try {
            const newProfile = await fs.promises.readFile(this.profilePath, 'utf8');
            if (newProfile !== this.userProfile) {
                console.log('Profile updated, reloading...');
                this.userProfile = newProfile;
            }
        } catch (error) {
            console.error('Failed to reload profile:', error);
        }
    }

    private deduplicateEntries<T extends Record<string, unknown>>(entries: T[], getKey: (entry: T) => string): T[] {
        const uniqueEntries = new Map<string, T>();
        entries.forEach(entry => {
            const key = getKey(entry);
            const existing = uniqueEntries.get(key);
            if (!existing || 
                ('timestamp' in entry && typeof entry.timestamp === 'string' &&
                'timestamp' in existing && typeof existing.timestamp === 'string' &&
                new Date(entry.timestamp) > new Date(existing.timestamp))) {
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
        const ocrEntries = screenData
            .filter((item): item is ContentItem & { type: 'OCR'; content: OCRContent } => 
                item.type === 'OCR' && 'text' in item.content);
            
        const rawOcrTexts = ocrEntries.map(item => ({
            text: item.content.text,
            timestamp: item.content.timestamp || new Date().toISOString(),
            appName: item.content.appName,
            url: item.content.url || '',
            title: item.content.title || ''
        }));

        const ocrTexts = this.deduplicateEntries(rawOcrTexts, entry => entry.text);

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
        const uiEntries = screenData
            .filter((item): item is ContentItem & { type: 'UI'; content: UIContent } => 
                item.type === 'UI');

        const rawUiActions = uiEntries.map(item => ({
            action: item.content.action || '',
            elementType: item.content.elementType || '',
            elementText: item.content.elementText || '',
            timestamp: item.content.timestamp || new Date().toISOString(),
            appName: item.content.appName || 'unknown',
            url: item.content.url || '',
            title: item.content.title || ''
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
            interval: 10,
        };
        console.log("loaded config:", JSON.stringify(config, null, 2));

        const interval = config.interval * 1000;
        const lookbackPeriod = 10 * 1000; // Look back 1 minute instead of an hour

        await this.sendToInbox(
            "computer log stream started",
            `monitoring computer work every ${config.interval} seconds, looking back 1 minute`
        );

        let lastLogEntry: ComputerLog | null = null;

        while (true) {
            try {
                // Reload profile before processing new entries
                await this.reloadProfile();

                const now = new Date();
                const oneMinuteAgo = new Date(now.getTime() - lookbackPeriod);

                console.log("\n=== Querying Screenpipe ===");
                console.log("Time range:", {
                    start: oneMinuteAgo.toISOString(),
                    end: now.toISOString()
                });

                // Query both OCR and UI interaction data
                console.log("Querying OCR data...");
                const baseOCRQuery: ScreenpipeQueryParams = {
                    startTime: oneMinuteAgo.toISOString(),
                    endTime: now.toISOString(),
                    limit: 50,
                    contentType: "ocr"
                };
                let ocrData = await pipe.queryScreenpipe(onlyChrome ? { ...baseOCRQuery, appName: "Chrome" } : baseOCRQuery);
                if (ocrData && Array.isArray(ocrData.data)) {
                    ocrData.data = this.deduplicateEntries(
                        ocrData.data.filter((item): item is ContentItem & { type: 'OCR'; content: OCRContent } => 
                            item.type === 'OCR' && 'text' in item.content
                        ),
                        (item) => item.content.text
                    );
                }

                console.log("Querying UI data...");
                const baseUIQuery: ScreenpipeQueryParams = {
                    startTime: oneMinuteAgo.toISOString(),
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
                    
                    // Only update if it's recent
                    const entryTime = new Date(logEntry.timestamp).getTime();
                    if (entryTime >= oneMinuteAgo.getTime()) {
                        lastLogEntry = logEntry;
                        await this.checkForWorkflows([lastLogEntry]);
                    }
                } else {
                    console.log("no relevant user activity detected in the last minute");
                    
                    // Debug why we might not be getting data
                    console.log("\n=== Debug Info ===");
                    console.log("OCR Query params:", {
                        startTime: oneMinuteAgo.toISOString(),
                        endTime: now.toISOString(),
                        limit: 50,
                        contentType: "ocr"
                    });
                    console.log("UI Query params:", {
                        startTime: oneMinuteAgo.toISOString(),
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

    private getPageContentHash(activity: any): string {
        // Create a content hash from OCR and UI data
        const content = [
            ...activity.ocrData.map((ocr: any) => ocr.text),
            ...activity.uiData.map((ui: any) => ui.text)
        ].join('\n');
        return content;
    }

    private shouldAnalyzeUrl(url: string, currentContent: string): boolean {
        const prevState = this.analyzedUrls.get(url);
        if (!prevState) return true; // New URL, never analyzed

        // Check if content has changed
        return prevState.lastContent !== currentContent;
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

        // Filter activities to only include recent ones (within last minute)
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000); // 1 minute ago
        const recentActivities = allActivities.filter(activity => {
            const activityTime = Math.max(
                ...activity.ocrData.map((ocr: any) => new Date(ocr.timestamp).getTime()),
                ...activity.uiData.map((ui: any) => new Date(ui.timestamp).getTime())
            );
            return activityTime >= oneMinuteAgo.getTime();
        });

        console.log(`Filtered ${allActivities.length} activities down to ${recentActivities.length} recent ones`);
        
        if (recentActivities.length === 0) {
            console.log("No recent activities found within the last minute");
            return;
        }

        const latestActivity = recentActivities[recentActivities.length - 1];
        const currentContent = this.getPageContentHash(latestActivity);

        console.log("Number of recent activities being analyzed:", 
            recentActivities.reduce((sum, act) => sum + act.ocrData.length + act.uiData.length, 0));

        const formResult = await this.formDetector.detectEmptyForms(recentActivities);
        
        if (formResult.hasForm && formResult.url) {
            console.log("\n=== URL Analysis ===");
            console.log("Detected form URL:", formResult.url);
            console.log("Previously analyzed URLs:", Array.from(this.analyzedUrls.keys()));

            if (this.shouldAnalyzeUrl(formResult.url, currentContent)) {
                console.log("Analyzing URL - content changed or new URL");
                await this.maybeProposeAgentAction(formResult);
                
                // Update URL state
                this.analyzedUrls.set(formResult.url, {
                    lastChecked: new Date().toISOString(),
                    lastContent: currentContent
                });
            } else {
                console.log("Skipping URL - no content changes detected");
            }
        }
    }

    async maybeProposeAgentAction(formResult: { hasForm: boolean; url: string | null; timestamp: string | null }): Promise<String | undefined> {
        if (!formResult.hasForm) {
            return;
        }

        console.log("\nCreating agent action proposal");

        const urlInfo = formResult.url ? ` on page ${formResult.url}` : '';
        const timeInfo = formResult.timestamp ? ` at ${formResult.timestamp}` : '';

        const prompt = `
            You are an intelligent task automation assistant. 
            There is an empty form${urlInfo}${timeInfo} that requires completion. 
            Analyze the screen state to suggest a task automation action.
            Include detailed step by step instruction on how to fill the form. For field in the form use following info aobut the user:
            ${this.userProfile}
            For fields in the form that are not described in the user profile just fill in some info on your best idea of how it should be filled for getting the best results.
            Format every step on a new line.
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
        const formattedTask = `TASK: ${task.replace(/\s+/g, ' ').trim()}`;
        console.log(formattedTask);

        // Use the new sendToInbox function
        await this.sendToInbox("Task Suggestion", formattedTask);
        return task;
    }
}

let profile = '';
try {
    const tmpDir = require('os').tmpdir();
    const profilePath = path.join(tmpDir, 'tasks-auto-complete-profile.txt');
    profile = fs.readFileSync(profilePath, 'utf8');
    console.log('Loaded user profile from:', profilePath);
    console.log('User profile:', profile);
} catch (error) {
    console.error('Failed to read user profile:', error);
    profile = 'Failed to load user profile';
}

const monitor = new WorkflowMonitor(profile);

monitor.streamComputerLogs(true).catch(error => {
    console.error("Error in streamComputerLogs:", error);
});
