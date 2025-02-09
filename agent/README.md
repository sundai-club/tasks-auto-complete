# AutoTask Agent

This is the Python agent component of AutoTask that handles browser automation and task execution.

## Setup Instructions

1. Make sure you have Python 3.8+ installed
2. Create and activate a virtual environment:

```bash
# Create virtual environment
python3 -m venv .venv

# Activate on macOS/Linux
source .venv/bin/activate

# Activate on Windows
.venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Install browser automation dependencies:
```bash
playwright install
```

## Troubleshooting

If you see "Module not found" errors, make sure:
1. You've activated the virtual environment
2. All dependencies are installed: `pip install -r requirements.txt`
3. The virtual environment is in the correct location (agent/.venv)

## Development

The agent uses:
- browser-use for web automation
- langchain-openai for AI integration
- playwright for browser control

Make sure to test any changes with:
```bash
python assistant.py "test-key" "test task"
```