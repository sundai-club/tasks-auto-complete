# Installation

```
virtualenv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install
```

# Usage

You must launch Chrome with remote debugging enabled in order for the extension to attach to it. If you have already running instances of Chrome, close them first before opening the updated Chrome window. 

```
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Run the agent:

```
python assistant.py <openai_api_key> <task_description>
```