1. Install dependencies (optional):
    ```
    cd pipe/tasks-auto-complete
    npm ci
    ```

    Dependencies are installed automatically in **Step 3**

2. Set the API key
   ```
   export OPENAI_API_KEY=your_openai_api_key
   ```

3. Install or rebuild the pipe:
   ```
   cd pipe/tasks-auto-complete
   npm run rebuild
   ```
4. Run the screenpipe
   ```
   screenpipe
   ```

5. Stop the pipe - otherwise you'll spend all your API credits. 

   `Ctrl` + `C` - in the terminal with screenpipe