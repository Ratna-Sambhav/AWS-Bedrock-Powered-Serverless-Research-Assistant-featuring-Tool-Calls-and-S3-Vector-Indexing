import React, { useState, useRef, useEffect } from 'react';
import { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand, ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

// ⚠️ REPLACE THESE WITH YOUR ACTUAL VALUES
const cognitoConfig = {
    region: process.env.REACT_APP_COGNITO_REGION,
    userPoolId: process.env.REACT_APP_USER_POOL_ID,
    clientId: process.env.REACT_APP_CLIENT_ID,
    identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID, // NEW: Cognito Identity Pool ID
    lambdaFunctionName: process.env.REACT_APP_LAMBDA_FUNCTION_NAME // NEW: Lambda function name (e.g., 'my-chat-function')
};


const cognitoClient = new CognitoIdentityProviderClient({ region: cognitoConfig.region });

const ChatInterface = () => {
    const CHUNK_DELAY = 100;

    // Authentication state
    const [authState, setAuthState] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [authError, setAuthError] = useState('');
    const [idToken, setIdToken] = useState(null);
    const [lambdaClient, setLambdaClient] = useState(null);

    // Chat state
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState([]);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const [collapsedStreamingHistory, setCollapsedStreamingHistory] = useState({});
    const [theme, setTheme] = useState('dark');
    const [chatWidth, setChatWidth] = useState(900);
    const [showSettings, setShowSettings] = useState(false);
    // Add to state declarations (around line 28)
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(150);
    const [selectedModel, setSelectedModel] = useState('Claude 3 Sonnet');

    const modelOptions = {
        "Claude 3 Haiku": "anthropic.claude-3-haiku-20240307-v1:0",
        "Claude 3.7 Sonnet": "anthropic.claude-3-7-sonnet-20250219-v1:0",
        "Claude Haiku 4.5": "anthropic.claude-haiku-4-5-20251001-v1:0",
        "Claude Opus 4.1": "anthropic.claude-opus-4-1-20250805-v1:0",
        "Claude Opus 4.5": "anthropic.claude-opus-4-5-20251101-v1:0",
        "Claude Opus 4": "anthropic.claude-opus-4-20250514-v1:0",
        "Claude Sonnet 4.5": "anthropic.claude-sonnet-4-5-20250929-v1:0",
        "Claude Sonnet 4": "anthropic.claude-sonnet-4-20250514-v1:0",
        "Claude 3 Sonnet": "anthropic.claude-3-sonnet-20240229-v1:0"
    };

    const themes = {
        dark: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            containerBg: 'rgba(255, 255, 255, 0.05)',
            headerBg: 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)',
            userMessageBg: 'linear-gradient(135deg, #e94560 0%, #d62839 100%)',
            assistantMessageBg: 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)',
            textColor: 'white',
            inputBg: 'rgba(255, 255, 255, 0.1)',
            inputBorder: 'rgba(255, 255, 255, 0.2)',
            sendButtonBg: 'linear-gradient(135deg, #e94560 0%, #d62839 100%)',
        },
        light: {
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            containerBg: 'rgba(255, 255, 255, 0.9)',
            headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            userMessageBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            assistantMessageBg: 'linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%)',
            textColor: '#2d3748',
            inputBg: 'rgba(255, 255, 255, 0.9)',
            inputBorder: 'rgba(0, 0, 0, 0.2)',
            sendButtonBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        },
        pinkBlue: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            containerBg: 'rgba(255, 255, 255, 0.05)',
            headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            userMessageBg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            assistantMessageBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            textColor: 'white',
            inputBg: 'rgba(255, 255, 255, 0.1)',
            inputBorder: 'rgba(255, 255, 255, 0.2)',
            sendButtonBg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        },
        darkGreen: {
            background: 'linear-gradient(135deg, #0a4d3c 0%, #1b5e20 50%, #2e7d32 100%)',
            containerBg: 'rgba(255, 255, 255, 0.05)',
            headerBg: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
            userMessageBg: 'linear-gradient(135deg, #43a047 0%, #66bb6a 100%)',
            assistantMessageBg: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
            textColor: 'white',
            inputBg: 'rgba(255, 255, 255, 0.1)',
            inputBorder: 'rgba(255, 255, 255, 0.2)',
            sendButtonBg: 'linear-gradient(135deg, #43a047 0%, #66bb6a 100%)',
        }
    };

    const currentTheme = themes[theme];

    // Initialize Lambda client with Cognito Identity Pool credentials
    const initializeLambdaClient = (token) => {
        console.log('[LAMBDA] Initializing Lambda client with Cognito credentials');

        const credentials = fromCognitoIdentityPool({
            clientConfig: { region: cognitoConfig.region },
            identityPoolId: cognitoConfig.identityPoolId,
            logins: {
                [`cognito-idp.${cognitoConfig.region}.amazonaws.com/${cognitoConfig.userPoolId}`]: token
            }
        });

        const client = new LambdaClient({
            region: cognitoConfig.region,
            credentials: credentials
        });

        setLambdaClient(client);
        console.log('[LAMBDA] Lambda client initialized');
    };

    useEffect(() => {
        console.log('[INIT] Component mounted');
        const storedIdToken = localStorage.getItem('idToken');
        if (storedIdToken) {
            console.log('[INIT] Found stored token, logging in automatically');
            setIdToken(storedIdToken);
            initializeLambdaClient(storedIdToken);
            setAuthState('authenticated');
        } else {
            console.log('[INIT] No stored token found');
        }
    }, []);

    const handleSignUp = async (e) => {
        e.preventDefault();
        setAuthError('');
        console.log('[SIGNUP] Starting signup process for:', email);

        if (password !== confirmPassword) {
            console.log('[SIGNUP] Password mismatch');
            setAuthError('Passwords do not match');
            return;
        }

        try {
            const command = new SignUpCommand({
                ClientId: cognitoConfig.clientId,
                Username: email,
                Password: password,
                UserAttributes: [{ Name: 'email', Value: email }]
            });
            console.log('[SIGNUP] Sending signup command');
            await cognitoClient.send(command);
            console.log('[SIGNUP] Signup successful, moving to verify');
            setAuthState('verify');
        } catch (error) {
            console.error('[SIGNUP] Error:', error);
            setAuthError(error.message || 'Sign up failed');
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setAuthError('');
        console.log('[VERIFY] Starting verification for:', email);

        try {
            const command = new ConfirmSignUpCommand({
                ClientId: cognitoConfig.clientId,
                Username: email,
                ConfirmationCode: verificationCode
            });
            console.log('[VERIFY] Sending verification command');
            await cognitoClient.send(command);
            console.log('[VERIFY] Verification successful');
            setAuthState('login');
            setAuthError('Account verified! Please login.');
        } catch (error) {
            console.error('[VERIFY] Error:', error);
            setAuthError(error.message || 'Verification failed');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError('');
        console.log('[LOGIN] Starting login for:', email);

        try {
            const command = new InitiateAuthCommand({
                AuthFlow: 'USER_PASSWORD_AUTH',
                ClientId: cognitoConfig.clientId,
                AuthParameters: {
                    USERNAME: email,
                    PASSWORD: password
                }
            });
            console.log('[LOGIN] Sending login command');
            const response = await cognitoClient.send(command);
            console.log('[LOGIN] Login response received:', response);

            if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
                console.log('[LOGIN] Password change required');
                setAuthError('Password change required. Please use Cognito console.');
                return;
            }

            const token = response.AuthenticationResult.IdToken;
            console.log('[LOGIN] Got ID token, length:', token?.length);
            setIdToken(token);
            localStorage.setItem('idToken', token);
            initializeLambdaClient(token);
            setAuthState('authenticated');
            console.log('[LOGIN] Login complete, authenticated');
        } catch (error) {
            console.error('[LOGIN] Error:', error);
            setAuthError(error.message || 'Login failed');
        }
    };

    const handleLogout = () => {
        console.log('[LOGOUT] Logging out');
        localStorage.removeItem('idToken');
        setIdToken(null);
        setLambdaClient(null);
        setAuthState('login');
        setMessages([]);
        setEmail('');
        setPassword('');
    };

    // Add this function after handleLogout (around line 215)
    const handleResetChat = () => {
        if (window.confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
            console.log('[RESET] Clearing chat history');
            setMessages([]);
            setStreamingContent([]);
            setCollapsedStreamingHistory({});
            setInputValue('');
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingContent]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [isLoading, messages]);

    const toggleStreamingHistory = (index) => {
        setCollapsedStreamingHistory(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const extractResultText = (text) => {
        const resultMatch = text.match(/<result>([\s\S]*?)<\/result>/);
        if (resultMatch) return resultMatch[1].trim();

        let lastJsonEnd = -1, depth = 0, inString = false, escapeNext = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (!inString) {
                if (char === '[' || char === '{') depth++;
                else if (char === ']' || char === '}') {
                    depth--;
                    if (depth === 0) lastJsonEnd = i;
                }
            }
        }

        if (lastJsonEnd !== -1) return text.substring(lastJsonEnd + 1).trim();
        return text.trim();
    };

    const hasToolCallResponse = (contentArray) => {
        return contentArray.some(item => item.type === 'tool_call_response');
    };

    const prepareHistoryForBackend = (messages) => {
        const prepared = messages.map(msg => {
            if (msg.role === 'user') return { role: msg.role, content: msg.content };
            let concatenatedText = '';
            msg.content.forEach(item => {
                if (item.text) {
                    concatenatedText += typeof item.text === 'string' ? item.text : JSON.stringify(item.text);
                }
            });
            return { role: msg.role, content: [{ text: concatenatedText }] };
        });
        console.log('[PREPARE] Prepared history:', prepared);
        return prepared;
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading || !lambdaClient) {
            console.log('[SEND] Cannot send - empty input, already loading, or no Lambda client');
            return;
        }

        console.log('[SEND] Starting to send message:', inputValue);
        const userMessage = { role: "user", content: [{ text: inputValue }] };
        const updatedHistory = [...messages, userMessage];
        setMessages(updatedHistory);
        setInputValue('');
        setIsLoading(true);
        setStreamingContent([]);

        try {
            // Update the payload in handleSendMessage function (around line 240)
            const payload = {
                history: JSON.stringify(prepareHistoryForBackend(updatedHistory)),
                model: modelOptions[selectedModel],
                temperature: temperature,
                maxTokens: maxTokens
            };

            console.log('[SEND] Invoking Lambda function:', cognitoConfig.lambdaFunctionName);
            console.log('[SEND] Payload:', payload);

            const command = new InvokeCommand({
                FunctionName: cognitoConfig.lambdaFunctionName,
                InvocationType: 'RequestResponse',
                Payload: JSON.stringify(payload)
            });

            const response = await lambdaClient.send(command);
            console.log('[SEND] RAW payload string:', new TextDecoder().decode(response.Payload));
            console.log('[SEND] Lambda response received:', {
                StatusCode: response.StatusCode,
                ExecutedVersion: response.ExecutedVersion
            });

            if (response.FunctionError) {
                throw new Error(`Lambda error: ${response.FunctionError}`);
            }

            // Decode the response payload
            const rawPayload = new TextDecoder().decode(response.Payload);
            console.log('[SEND] Response payload (raw):', rawPayload);

            // Parse concatenated JSON objects
            let currentStreamContent = [];
            const jsonObjects = [];

            // Split by }{  to separate concatenated JSON objects
            const jsonStrings = rawPayload.split(/(?<=\})(?=\{)/);

            for (const jsonStr of jsonStrings) {
                try {
                    const parsed = JSON.parse(jsonStr);
                    jsonObjects.push(parsed);
                } catch (e) {
                    console.warn('[SEND] Failed to parse chunk:', jsonStr.substring(0, 100));
                }
            }

            console.log('[SEND] Parsed JSON objects:', jsonObjects.length);

            // Process the chunks
            for (const chunk of jsonObjects) {
                // Skip the initial statusCode response
                if (chunk.statusCode) {
                    console.log('[SEND] Skipping status response');
                    continue;
                }

                // Add valid content chunks
                if (chunk.text !== undefined && chunk.type) {
                    await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
                    currentStreamContent.push(chunk);
                    setStreamingContent([...currentStreamContent]);
                }
            }

            console.log('[SEND] Final stream content array length:', currentStreamContent.length);

            if (currentStreamContent.length > 0) {
                let concatenatedText = '';
                currentStreamContent.forEach(item => {
                    if (item.text) {
                        concatenatedText += typeof item.text === 'string' ? item.text : JSON.stringify(item.text);
                    }
                });

                console.log('[SEND] Concatenated text length:', concatenatedText.length);
                console.log('[SEND] First 200 chars:', concatenatedText.substring(0, 200));

                const displayText = extractResultText(concatenatedText);
                console.log('[SEND] Extracted display text length:', displayText.length);

                const assistantMessage = {
                    role: "assistant",
                    content: currentStreamContent,
                    displayText: displayText,
                };

                console.log('[SEND] Creating assistant message:', assistantMessage);
                setMessages([...updatedHistory, assistantMessage]);
            } else {
                console.warn('[SEND] No content received from Lambda!');
            }
            setStreamingContent([]);
        } catch (error) {
            console.error('[SEND] Fatal error:', error);
            console.error('[SEND] Error stack:', error.stack);
            alert(`Failed to get response: ${error.message}. Check console for details.`);
        } finally {
            console.log('[SEND] Request complete, setting loading to false');
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const renderContent = (contentArray, isStreaming = false, showToolCalls = true) => {
        let textBuffer = '';
        const elements = [];

        contentArray.forEach((item, index) => {
            if (!item || !item.type) {
                if (item?.text && typeof item.text === 'string') textBuffer += item.text;
                return;
            }

            if (item.type === 'common_text') {
                if (item.text && typeof item.text === 'string') textBuffer += item.text;
            } else if (item.type === 'tool_call') {
                if (textBuffer && showToolCalls) {
                    elements.push(<p key={`text-${index}`} style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{textBuffer}</p>);
                    textBuffer = '';
                }

                if (showToolCalls) {
                    const toolCallData = Array.isArray(item.text) ? item.text[0] : item.text;
                    const toolName = toolCallData?.tool_name || toolCallData?.name || 'Tool';
                    const toolInput = toolCallData?.tool_input || toolCallData?.input;

                    elements.push(
                        <div key={`tool-${index}`} style={{ margin: '10px 0', padding: '12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', borderLeft: '3px solid #f093fb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
                                🔧 Tool Call: {toolName}
                                {isStreaming && <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255, 255, 255, 0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>}
                            </div>
                            {toolInput && (
                                <pre style={{
                                    margin: '8px 0 0 0',
                                    padding: '8px',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    overflow: 'auto',
                                    maxHeight: '200px'
                                }}>
                                    {JSON.stringify(toolInput, null, 2)}
                                </pre>
                            )}
                        </div>
                    );
                }
            } else if (item.type === 'tool_call_response') {
                if (textBuffer && showToolCalls) {
                    elements.push(<p key={`text-${index}`} style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{textBuffer}</p>);
                    textBuffer = '';
                }

                if (showToolCalls) {
                    const responseData = Array.isArray(item.text) ? item.text[0] : item.text;

                    elements.push(
                        <div key={`tool-response-${index}`} style={{ margin: '10px 0', padding: '12px', background: 'rgba(76, 175, 80, 0.2)', borderRadius: '8px', borderLeft: '3px solid #4caf50' }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
                                ✅ Tool Response
                            </div>
                            <pre style={{
                                margin: 0,
                                padding: '8px',
                                background: 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '4px',
                                fontSize: '12px',
                                overflow: 'auto',
                                maxHeight: '300px',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {JSON.stringify(responseData, null, 2)}
                            </pre>
                        </div>
                    );
                }
            }
        });

        if (textBuffer) elements.push(<p key="text-final" style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{textBuffer}</p>);
        return elements;
    };

    // Authentication UI
    if (authState !== 'authenticated') {
        return (
            <div style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: currentTheme.background, backgroundAttachment: 'fixed', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ maxWidth: '400px', width: '100%', background: currentTheme.containerBg, backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '40px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)' }}>
                    <h1 style={{ color: currentTheme.textColor, textAlign: 'center', marginBottom: '10px' }}>Dr. Heinrich Weber</h1>
                    <p style={{ color: currentTheme.textColor, textAlign: 'center', fontSize: '14px', marginBottom: '30px', opacity: 0.8 }}>AI/ML Research Assistant</p>

                    {authState === 'login' && (
                        <form onSubmit={handleLogin}>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: 'none', background: currentTheme.inputBg, color: currentTheme.textColor, fontSize: '14px' }}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: 'none', background: currentTheme.inputBg, color: currentTheme.textColor, fontSize: '14px' }}
                                required
                            />
                            {authError && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '15px' }}>{authError}</p>}
                            <button type="submit" style={{ width: '100%', padding: '12px', background: currentTheme.sendButtonBg, color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginBottom: '15px' }}>Login</button>
                            <p style={{ textAlign: 'center', color: currentTheme.textColor, fontSize: '14px' }}>
                                Don't have an account? <span onClick={() => setAuthState('signup')} style={{ color: '#667eea', cursor: 'pointer', fontWeight: '600' }}>Sign Up</span>
                            </p>
                        </form>
                    )}

                    {authState === 'signup' && (
                        <form onSubmit={handleSignUp}>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: 'none', background: currentTheme.inputBg, color: currentTheme.textColor, fontSize: '14px' }}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: 'none', background: currentTheme.inputBg, color: currentTheme.textColor, fontSize: '14px' }}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: 'none', background: currentTheme.inputBg, color: currentTheme.textColor, fontSize: '14px' }}
                                required
                            />
                            {authError && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '15px' }}>{authError}</p>}
                            <button type="submit" style={{ width: '100%', padding: '12px', background: currentTheme.sendButtonBg, color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginBottom: '15px' }}>Sign Up</button>
                            <p style={{ textAlign: 'center', color: currentTheme.textColor, fontSize: '14px' }}>
                                Already have an account? <span onClick={() => setAuthState('login')} style={{ color: '#667eea', cursor: 'pointer', fontWeight: '600' }}>Login</span>
                            </p>
                        </form>
                    )}

                    {authState === 'verify' && (
                        <form onSubmit={handleVerify}>
                            <p style={{ color: currentTheme.textColor, marginBottom: '20px', fontSize: '14px' }}>Please check your email for a verification code.</p>
                            <input
                                type="text"
                                placeholder="Verification Code"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: 'none', background: currentTheme.inputBg, color: currentTheme.textColor, fontSize: '14px' }}
                                required
                            />
                            {authError && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '15px' }}>{authError}</p>}
                            <button type="submit" style={{ width: '100%', padding: '12px', background: currentTheme.sendButtonBg, color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Verify</button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // Main Chat UI (when authenticated)
    return (
        <div style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: currentTheme.background, backgroundAttachment: 'fixed', minHeight: '100vh', margin: 0, padding: 0 }}>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div style={{ maxWidth: `${chatWidth}px`, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', background: currentTheme.containerBg, backdropFilter: 'blur(10px)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)' }}>
                <div style={{ background: currentTheme.headerBg, padding: '12px 20px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ color: 'white', fontSize: '18px', margin: 0, fontWeight: '600', textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)' }}>Your AI/ML Research Assistant</h1>
                        <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '11px', margin: '2px 0 0 0' }}> Explore Famous AI/ML Papers with Dr. Heinrich Weber </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'rgba(255, 255, 255, 0.2)', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px', transition: 'background 0.2s' }}>⚙️</button>
                        <button onClick={handleLogout} style={{ background: 'rgba(255, 255, 255, 0.2)', border: 'none', borderRadius: '8px', padding: '0 12px', height: '36px', cursor: 'pointer', fontSize: '14px', color: 'white', fontWeight: '600' }}>Logout</button>
                    </div>
                </div>



                {/* Settings Area */}
                {showSettings && (

                    // Replace the settings section content (inside the showSettings div, around line 545)
                    <div style={{ background: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)', padding: '20px', borderBottom: `2px solid ${theme === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.2)'}`, color: currentTheme.textColor }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>Settings</h3>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Model</label>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '2px solid rgba(255, 255, 255, 0.2)',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: currentTheme.textColor,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                {Object.keys(modelOptions).map((modelName) => (
                                    <option key={modelName} value={modelName} style={{ background: theme === 'light' ? '#fff' : '#1a1a2e', color: theme === 'light' ? '#000' : '#fff' }}>
                                        {modelName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Temperature: {temperature}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={temperature}
                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                style={{ width: '100%', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                                <span>0 (Precise)</span>
                                <span>1 (Creative)</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Max Tokens: {maxTokens}</label>
                            <input
                                type="range"
                                min="50"
                                max="500"
                                step="10"
                                value={maxTokens}
                                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                style={{ width: '100%', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                                <span>50</span>
                                <span>500</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Theme</label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {['dark', 'light', 'pinkBlue', 'darkGreen'].map((t) => (
                                    <button key={t} onClick={() => setTheme(t)} style={{ padding: '8px 16px', borderRadius: '6px', border: theme === t ? '2px solid #4299e1' : '2px solid transparent', background: theme === t ? 'rgba(66, 153, 225, 0.2)' : 'rgba(255, 255, 255, 0.1)', color: currentTheme.textColor, cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                                        {t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : t === 'pinkBlue' ? 'Pink-Blue' : 'Dark-Green'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Chat Width: {chatWidth}px</label>
                            <input type="range" min="600" max="1400" step="50" value={chatWidth} onChange={(e) => setChatWidth(parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
                        </div>
                    </div>

                )}





                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {messages.map((message, index) => (
                        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: message.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.3s ease-in' }}>
                            {message.role === 'assistant' && <div style={{ fontSize: '12px', fontWeight: '600', color: theme === 'light' ? '#4a5568' : 'rgba(255, 255, 255, 0.9)', padding: '0 12px' }}>Dr. Heinrich Weber</div>}
                            {message.role === 'assistant' ? (
                                <>
                                    {hasToolCallResponse(message.content) && (
                                        <div style={{ margin: '10px 0 15px 0', border: `1px solid ${theme === 'light' ? '#d1d5db' : 'rgba(255, 255, 255, 0.2)'}`, borderRadius: '8px', overflow: 'hidden', maxWidth: '75%' }}>
                                            <button onClick={() => toggleStreamingHistory(index)} style={{ width: '100%', padding: '12px 16px', background: theme === 'light' ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: '600', fontSize: '14px', display: 'flex', justifyContent: 'space-between', color: currentTheme.textColor }}>
                                                <span>🔧 Tool Call History</span><span>{collapsedStreamingHistory[index] ? '▶' : '▼'}</span>
                                            </button>
                                            {!collapsedStreamingHistory[index] && (
                                                <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto', background: theme === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.2)' }}>
                                                    {renderContent(
                                                        message.content.filter(item => item.type === 'tool_call' || item.type === 'tool_call_response'),
                                                        false,
                                                        true
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ maxWidth: '75%', padding: '15px 20px', borderRadius: '18px', background: currentTheme.assistantMessageBg, color: currentTheme.textColor, boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)', borderBottomLeftRadius: '4px' }}>
                                        <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{message.displayText}</p>
                                    </div>
                                </>
                            ) : (
                                <div style={{ maxWidth: '75%', padding: '15px 20px', borderRadius: '18px', background: currentTheme.userMessageBg, color: 'white', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)', borderBottomRightRadius: '4px' }}>
                                    <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{message.content[0].text}</p>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Streaming content - show tool calls during streaming */}
                    {streamingContent.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', animation: 'fadeIn 0.3s ease-in' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: theme === 'light' ? '#4a5568' : 'rgba(255, 255, 255, 0.9)', padding: '0 12px' }}>Dr. Heinrich Weber</div>
                            <div style={{ maxWidth: '75%', padding: '15px 20px', borderRadius: '18px', background: currentTheme.assistantMessageBg, color: currentTheme.textColor, boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)', borderBottomLeftRadius: '4px' }}>
                                {renderContent(streamingContent, true, true)}
                                <span style={{ animation: 'blink 1s infinite', fontWeight: 'bold', marginLeft: '2px' }}>|</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div style={{ padding: '20px', background: theme === 'light' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.3)', backdropFilter: 'blur(10px)', display: 'flex', gap: '10px', alignItems: 'flex-end', boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.2)' }}>
                    <textarea ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={handleKeyPress} placeholder="Ask Dr. Weber anything..." disabled={isLoading} rows="1" style={{ flex: 1, padding: '15px', border: `2px solid ${currentTheme.inputBorder}`, borderRadius: '25px', background: currentTheme.inputBg, color: currentTheme.textColor, fontSize: '16px', resize: 'none', outline: 'none', maxHeight: '120px' }} />
                    <button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()} style={{ width: '50px', height: '50px', borderRadius: '50%', border: 'none', background: currentTheme.sendButtonBg, color: 'white', fontSize: '24px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (isLoading || !inputValue.trim()) ? 0.5 : 1 }}>
                        {isLoading ? '...' : '→'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;