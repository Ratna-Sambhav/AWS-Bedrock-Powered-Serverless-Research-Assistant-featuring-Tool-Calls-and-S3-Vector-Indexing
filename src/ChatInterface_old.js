import React, { useState, useRef, useEffect } from 'react';

const ChatInterface = () => {
  const CHUNK_DELAY = 100;
  
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
    return messages.map(msg => {
      if (msg.role === 'user') return { role: msg.role, content: msg.content };
      let concatenatedText = '';
      msg.content.forEach(item => {
        if (item.text) {
          concatenatedText += typeof item.text === 'string' ? item.text : JSON.stringify(item.text);
        }
      });
      return { role: msg.role, content: [{ text: concatenatedText }] };
    });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { role: "user", content: [{ text: inputValue }] };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputValue('');
    setIsLoading(true);
    setStreamingContent([]);

    try {
      const response = await fetch("https://xs44xrhppdp67w4ago7adibxaa0phfyy.lambda-url.us-west-2.on.aws/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: JSON.stringify(prepareHistoryForBackend(updatedHistory)),
          model: "anthropic.claude-3-sonnet-20240229-v1:0"
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', currentStreamContent = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let lastClosingBrace = -1, currentOpenBraces = 0;

        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] === '{') currentOpenBraces++;
          else if (buffer[i] === '}') {
            currentOpenBraces--;
            if (currentOpenBraces === 0) {
              const jsonString = buffer.substring(lastClosingBrace + 1, i + 1).trim();
              try {
                const data = JSON.parse(jsonString);
                await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
                currentStreamContent.push(data);
                setStreamingContent([...currentStreamContent]);
              } catch (e) {}
              lastClosingBrace = i;
            }
          }
        }
        if (lastClosingBrace !== -1) buffer = buffer.substring(lastClosingBrace + 1);
      }

      if (currentStreamContent.length > 0) {
        let concatenatedText = '';
        currentStreamContent.forEach(item => {
          if (item.text) {
            concatenatedText += typeof item.text === 'string' ? item.text : JSON.stringify(item.text);
          }
        });
        
        const assistantMessage = {
          role: "assistant",
          content: currentStreamContent,
          displayText: extractResultText(concatenatedText),
        };
        setMessages([...updatedHistory, assistantMessage]);
      }
      setStreamingContent([]);
    } catch (error) {
      alert('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderContent = (contentArray, isStreaming = false) => {
    let textBuffer = '';
    const elements = [];

    contentArray.forEach((item, index) => {
      if (!item || !item.type) {
        if (item?.text && typeof item.text === 'string') textBuffer += item.text;
        return;
      }

      if (item.type === 'common_text') {
        if (item.text && typeof item.text === 'string') textBuffer += item.text;
      } else {
        if (textBuffer) {
          elements.push(<p key={`text-${index}`} style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{textBuffer}</p>);
          textBuffer = '';
        }
        
        if (item.type === 'tool_call') {
          const toolCallData = Array.isArray(item.text) ? item.text[0] : item.text;
          const toolName = toolCallData?.tool_name || toolCallData?.name || 'Tool';
          elements.push(
            <div key={`tool-${index}`} style={{ margin: '10px 0', padding: '12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', borderLeft: '3px solid #f093fb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '14px' }}>
                🔧 {toolName}
                {isStreaming && <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255, 255, 255, 0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>}
              </div>
            </div>
          );
        }
      }
    });

    if (textBuffer) elements.push(<p key="text-final" style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{textBuffer}</p>);
    return elements;
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: currentTheme.background, backgroundAttachment: 'fixed', minHeight: '100vh', margin: 0, padding: 0 }}>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      <div style={{ maxWidth: `${chatWidth}px`, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', background: currentTheme.containerBg, backdropFilter: 'blur(10px)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)' }}>
        <div style={{ background: currentTheme.headerBg, padding: '12px 20px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '18px', margin: 0, fontWeight: '600', textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)' }}>Dr. Heinrich Weber</h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '11px', margin: '2px 0 0 0' }}>Your Research Assistant To Explore and Understand AI/ML Famous Papers</p>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'rgba(255, 255, 255, 0.2)', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px', transition: 'background 0.2s' }}>⚙️</button>
        </div>

        {showSettings && (
          <div style={{ background: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)', padding: '20px', borderBottom: `2px solid ${theme === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.2)'}`, color: currentTheme.textColor }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>Settings</h3>
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
                        <span>📜 Streaming History</span><span>{collapsedStreamingHistory[index] ? '▶' : '▼'}</span>
                      </button>
                      {collapsedStreamingHistory[index] && <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>{renderContent(message.content)}</div>}
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
          {streamingContent.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', animation: 'fadeIn 0.3s ease-in' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: theme === 'light' ? '#4a5568' : 'rgba(255, 255, 255, 0.9)', padding: '0 12px' }}>Dr. Heinrich Weber</div>
              <div style={{ maxWidth: '75%', padding: '15px 20px', borderRadius: '18px', background: currentTheme.assistantMessageBg, color: currentTheme.textColor, boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)', borderBottomLeftRadius: '4px' }}>
                {renderContent(streamingContent, true)}
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