/**
 * Node.js script with enhanced logging for tool_call and tool_call_response types.
 */

const https = require('https');
const querystring = require('querystring');

// --- Configuration ---
const FUNCTION_URL = "https://45q3oqiimsr3m7imlaqvttk25e0ayadl.lambda-url.us-west-2.on.aws/";
const CONVERSATION_HISTORY = [{
    "role": "user",
    "content": [{
        "text": "Tell me the names of the authors of the paper where spreadsheetllm is mentioned"
    }]
}];
const MODEL_NAME = "anthropic.claude-3-sonnet-20240229-v1:0";

// --- Custom Logging Function ---
function logChunk(data) {
    if (!data || !data.type) return;

    switch (data.type) {
        case 'common_text':
            if (data.text && !Array.isArray(data.text)) {
                // Log common text chunks without a newline
                process.stdout.write(data.text);
            }
            break;

        case 'tool_call':
            // Log tool_call data with clear formatting
            console.log('\n\n--- 🔨 TOOL CALL START ---');
            console.log(JSON.stringify(data.text, null, 2));
            console.log('--- 🔨 TOOL CALL END ---');
            break;

        case 'tool_call_response':
            // Log tool_call_response data with clear formatting
            console.log('\n\n--- 🛠️ TOOL RESPONSE START ---');
            // The text field here is typically an array containing the tool result object
            console.log(JSON.stringify(data.text, null, 2));
            console.log('--- 🛠️ TOOL RESPONSE END ---');
            break;
            
        // You may encounter other types, such as 'metadata', which we'll ignore for this task
        default:
            break;
    }
}

// --- Main Invocation Function ---
function invokeLambdaViaUrl() {
    const params = {
        'history': JSON.stringify(CONVERSATION_HISTORY),
        'model': MODEL_NAME
    };
    const query = querystring.stringify(params);
    const url = new URL(FUNCTION_URL);
    url.search = query;

    console.log(`Making request to: ${url.toString()}`);
    console.log('--- Streaming Response Content ---');

    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
    };

    const req = https.request(options, (res) => {
        let buffer = '';

        res.on('data', (chunk) => {
            buffer += chunk.toString();
            let lastClosingBrace = -1;
            let currentOpenBraces = 0;

            // Iterate through the buffer to find complete JSON objects
            for (let i = 0; i < buffer.length; i++) {
                if (buffer[i] === '{') {
                    currentOpenBraces++;
                } else if (buffer[i] === '}') {
                    currentOpenBraces--;
                    if (currentOpenBraces === 0) {
                        const jsonString = buffer.substring(lastClosingBrace + 1, i + 1).trim();
                        try {
                            const data = JSON.parse(jsonString);
                            logChunk(data); // Log the parsed chunk
                        } catch (e) {
                            // Silently ignore incomplete or malformed JSON chunks
                        }
                        lastClosingBrace = i;
                    }
                }
            }

            // Keep only the incomplete part of the buffer
            if (lastClosingBrace !== -1) {
                buffer = buffer.substring(lastClosingBrace + 1);
            }
        });

        res.on('end', () => {
            console.log('\n--- Stream Ended Successfully ---');
        });
    });

    // --- Error Logging ---
    req.on('error', (e) => {
        console.error(`\n🚨 Request Failed!`);
        console.error(`Error Code (e.code): ${e.code || 'N/A'}`);
        console.error(`Full Error Message (e.message): ${e.message}`);
        console.error(`\n*** This suggests a network/system-level issue, not a code issue. ***`);
    });

    req.end();
}

// Execute the function
invokeLambdaViaUrl();