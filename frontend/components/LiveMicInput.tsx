import { useState, useEffect, useRef } from 'react';
import { Company } from '../types/company';
import './LiveMicInput.css';

interface NlpAnalysis {
  is_abusive: boolean;
  severity: string;
  flagged_categories: string[];
  scores: Record<string, number>;
}

interface LiveMicInputProps {
  company?: Company;
  companyId?: string;
  onAnalysisResult?: (analysis: NlpAnalysis) => void;
  compact?: boolean;
}

const LiveMicInput = ({ company, companyId: propCompanyId, onAnalysisResult, compact }: LiveMicInputProps) => {
  const effectiveCompanyId = company?.id ?? propCompanyId ?? 'company-001';
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastWarning, setLastWarning] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const analyzingRef = useRef(false);
  const analyzeRef = useRef<(text: string) => void>(() => {});

  // Initialize Web Speech API (browser's built-in speech recognition)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interimTranscript += t;
        }
      }

      setTranscript(finalTranscript + interimTranscript);

      // Analyze final transcript via ref (avoids stale closure)
      if (finalTranscript.trim().length > 0) {
        analyzeRef.current(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'network') return;
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (_e) {
          // Already started, ignore
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
        isRecordingRef.current = true;
      }
    } catch (err: any) {
      setError(`Failed to access microphone: ${err.message}`);
      console.error('Microphone access error:', err);
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setTranscript('');
    setLastWarning(null);
  };

  const analyzeText = async (text: string) => {
    if (!text.trim() || analyzingRef.current) return;

    analyzingRef.current = true;
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/report-abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          companyId: effectiveCompanyId,
          factoryId: effectiveCompanyId,
          workerId: 'demo-worker',
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Notify parent of NLP results (for morale integration)
      if (onAnalysisResult && data.analysis) {
        onAnalysisResult(data.analysis);
      }

      if (data.warning) {
        setLastWarning({
          ...data.warning,
          text: text.trim(),
        });
      } else {
        setLastWarning(null);
      }
    } catch (err: any) {
      console.error('Error analyzing text:', err);
      setError(`Analysis failed: ${err.message}`);
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  // Keep ref in sync so speech recognition closure always calls latest version
  analyzeRef.current = analyzeText;

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      analyzeText(textInput.trim());
      setTextInput('');
    }
  };

  const handleManualAnalyze = () => {
    if (transcript.trim()) {
      analyzeText(transcript.trim());
    }
  };

  // Compact mode for LiveFeed integration
  if (compact) {
    return (
      <div className="live-mic-compact">
        <div className="mic-compact-row">
          <button
            className={`mic-compact-btn ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? '⏹ Stop' : '🎤 Mic'}
          </button>
          <input
            className="mic-compact-input"
            type="text"
            placeholder="Type to analyze..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            disabled={isAnalyzing}
          />
          <button
            className="mic-compact-send"
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || isAnalyzing}
          >
            {isAnalyzing ? '...' : '→'}
          </button>
        </div>
        {isRecording && <span className="mic-compact-status">● Listening...</span>}
        {transcript && (
          <div className="mic-compact-transcript">{transcript}</div>
        )}
        {lastWarning && (
          <div className={`mic-compact-warning ${lastWarning.severity}`}>
            Abuse detected: {lastWarning.categories.join(', ')}
          </div>
        )}
        {error && <div className="mic-compact-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="live-mic-input">
      <div className="mic-header">
        <h3>🎤 Live Voice Input (Demo)</h3>
        <div className="mic-status">
          {isRecording ? (
            <span className="status-recording">● Recording</span>
          ) : (
            <span className="status-idle">○ Idle</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mic-error">
          <p>⚠️ {error}</p>
        </div>
      )}

      <div className="mic-controls">
        {!isRecording ? (
          <button onClick={startRecording} className="btn-start">
            🎤 Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="btn-stop">
            ⏹️ Stop Recording
          </button>
        )}
      </div>

      {transcript && (
        <div className="transcript-section">
          <div className="transcript-header">
            <h4>Live Transcript:</h4>
            {isAnalyzing && <span className="analyzing-badge">Analyzing...</span>}
          </div>
          <div className="transcript-text">
            {transcript}
          </div>
          {transcript.trim() && !isAnalyzing && (
            <button onClick={handleManualAnalyze} className="btn-analyze">
              🔍 Analyze Text
            </button>
          )}
        </div>
      )}

      {lastWarning && (
        <div className={`warning-display ${lastWarning.severity}`}>
          <div className="warning-header">
            <h4>🚨 Abuse Detected!</h4>
            <span className={`severity-badge ${lastWarning.severity}`}>
              {lastWarning.severity === 'high' ? '🔴 High' : '🟡 Medium'}
            </span>
          </div>
          <div className="warning-text">
            <p><strong>Analyzed text:</strong> "{lastWarning.text}"</p>
            <p><strong>Message:</strong> {lastWarning.message}</p>
          </div>
          <div className="warning-categories">
            {lastWarning.categories.map((cat: string, idx: number) => (
              <span key={idx} className="category-tag">
                {cat.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {!isRecording && !transcript && (
        <div className="mic-instructions">
          <p>Click "Start Recording" to begin live voice analysis.</p>
          <p className="hint">The system will automatically transcribe and analyze speech for verbal abuse.</p>
          <p className="hint">⚠️ Requires microphone permission and Chrome/Edge browser for best results.</p>
        </div>
      )}
    </div>
  );
};

export default LiveMicInput;
