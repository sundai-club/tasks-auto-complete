import os
os.environ["ANONYMIZED_TELEMETRY"] = "false"
import sys

from langchain_openai import ChatOpenAI
from browser_use import Agent, BrowserConfig, Browser
import asyncio
from dotenv import load_dotenv
load_dotenv()

chrome_instance_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

def get_args():
    if len(sys.argv) != 3:
        print("Usage: python assistant.py <openai_api_key> <task_description>")
        sys.exit(1)
    return sys.argv[1], sys.argv[2]

async def main():
    openai_api_key, task_description = get_args()
    os.environ["OPENAI_API_KEY"] = openai_api_key

    config = BrowserConfig(
        chrome_instance_path=chrome_instance_path
    )
    browser = Browser(config=config)
    
    agent = Agent(
        task=task_description,
        llm=ChatOpenAI(model="gpt-4o-mini"),
        browser=browser
    )
    result = await agent.run()
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
