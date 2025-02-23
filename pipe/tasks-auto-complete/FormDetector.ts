import { spawn } from 'child_process';

interface ComputerLog {
    platform: string;
    identifier: string;
    timestamp: string;
    content: string;
}

export class FormDetector {
    private readonly model: string = 'llama3.2';
    private readonly timeoutMs: number = 30000; // 30 second timeout

    /**
     * Analyzes computer logs to detect web pages with empty forms
     * @param logs Array of ComputerLog entries to analyze
     * @returns Promise<boolean> true if an empty form is detected
     */
    public async detectEmptyForms(logs: ComputerLog[]): Promise<boolean> {
        // Simplify the prompt to reduce complexity
        const prompt = `Analyze this computer activity and respond with 'true' if you see an empty web form, or 'false' if not:\n${JSON.stringify(logs, null, 2)}`;

        console.log("\n=== Using Model ===\n", this.model);
        console.log("\n=== Prompt ===\n", prompt);

        try {
            const result = await this.runOllama(prompt);
            console.log("\n=== LLM Response ===\n", result);
            return result.toLowerCase().includes('true');
        } catch (error) {
            console.error('Error in detectEmptyForms:', error);
            return false;
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
