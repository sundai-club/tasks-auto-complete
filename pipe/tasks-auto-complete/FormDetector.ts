import { spawn } from 'child_process';

interface ComputerLog {
    platform: string;
    identifier: string;
    timestamp: string;
    content: string;
}

interface FormDetectionResult {
    hasForm: boolean;
    url: string | null;
    timestamp: string | null;
}

export class FormDetector {
    private readonly model: string = 'llama3.2';
    private readonly timeoutMs: number = 30000; // 30 second timeout

    /**
     * Analyzes computer logs to detect web pages with empty forms
     * @param logs Array of ComputerLog entries to analyze
     * @returns Promise<FormDetectionResult> containing form detection status and URL
     */
    public async detectEmptyForms(logs: ComputerLog[]): Promise<FormDetectionResult> {
        // Simplify the prompt to reduce complexity
        const prompt = `You are a JSON-only responder. Output ONLY a JSON object with no additional text.

Required format:
{
    "hasForm": boolean,    // true if empty form detected
    "url": string|null,    // URL of the page with form
    "timestamp": string|null // ISO timestamp when form was detected
}

Example of valid response:
{
    "hasForm": true,
    "url": "https://example.com/form",
    "timestamp": "2023-09-01T10:00:00Z"
}

Your goal is to determine if these screen states contain an empty web form among them. If you find an empty form, you should return it's URL. Analyze these logs and respond with ONLY the JSON object, no other text:
${JSON.stringify(logs, null, 2)}`;

        console.log("\n=== Using Ollama Model ===\n", this.model);
        console.log("\n=== Prompt ===\n", prompt);

        try {
            const result = await this.runOllama(prompt);
            console.log("\n=== Ollama Response ===\n", result);

            try {
                // Extract JSON from the response if there's any extra text
                const jsonMatch = result.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in response');
                }

                const jsonStr = jsonMatch[0];
                const parsed = JSON.parse(jsonStr);

                // Validate the parsed JSON has the required format
                if (typeof parsed.hasForm !== 'boolean') {
                    throw new Error('Invalid hasForm type');
                }

                return {
                    hasForm: parsed.hasForm,
                    url: typeof parsed.url === 'string' ? parsed.url : null,
                    timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : null
                };
            } catch (parseError) {
                console.error('Error parsing LLM response:', parseError);
                console.error('Raw response:', result);
                return {
                    hasForm: false,
                    url: null,
                    timestamp: null
                };
            }
        } catch (error) {
            console.error('Error in detectEmptyForms:', error);
            return {
                hasForm: false,
                url: null,
                timestamp: null
            };
        }
    }

    private runOllama(prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const ollamaProcess = spawn('ollama', ['run', this.model], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let error = '';
            const timeout = setTimeout(() => {
                ollamaProcess.kill();
                reject(new Error('Ollama process timed out after ' + this.timeoutMs + 'ms'));
            }, this.timeoutMs);

            ollamaProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
            });

            ollamaProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                error += chunk;
            });

            ollamaProcess.on('close', (code) => {
                clearTimeout(timeout);
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Ollama process exited with code ${code}\nError: ${error}`));
                }
            });

            ollamaProcess.stdin.write(prompt);
            ollamaProcess.stdin.end();
        });
    }
}
