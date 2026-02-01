
import React, { useState, useRef, useCallback } from 'react';
import { GeminiService, decodeBase64, decodeAudioData } from './GeminiService';
import { LandmarkAnalysis, AppState } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<LandmarkAnalysis | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isApiKeyChecked, setIsApiKeyChecked] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleApiKeySelection = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setIsApiKeyChecked(true);
  };

  const processImage = async (file: File) => {
    // Check for API key first as gemini-3-pro requires it
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey && !isApiKeyChecked) {
      await handleApiKeySelection();
      return;
    }

    setState(AppState.LOADING_IMAGE);
    setError(null);
    setAnalysis(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);

      try {
        // 1. Identify
        const name = await GeminiService.identifyLandmark(base64);
        if (name === "Unknown") {
          throw new Error("Could not identify a landmark in this photo.");
        }

        // 2. Search History
        setState(AppState.SEARCHING_HISTORY);
        const { history, sources } = await GeminiService.getLandmarkHistory(name);

        // 3. Generate Narration
        setState(AppState.GENERATING_AUDIO);
        const audioData = await GeminiService.generateNarration(history);

        setAnalysis({ name, history, sources, audioData });
        setState(AppState.PLAYING);
        playAudio(audioData);

      } catch (err: any) {
        if (err.message?.includes("Requested entity was not found")) {
          setError("API key session expired. Please select your key again.");
          await handleApiKeySelection();
        } else {
          setError(err.message || "An unexpected error occurred.");
        }
        setState(AppState.ERROR);
      }
    };
    reader.readAsDataURL(file);
  };

  const playAudio = async (base64Audio: string) => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    const decoded = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(decoded, audioContextRef.current, 24000, 1);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
    audioSourceRef.current = source;
  };

  const stopExperience = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
    }
    setState(AppState.IDLE);
    setAnalysis(null);
    setImagePreview(null);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans">
      {/* Header */}
      <header className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          CityLens AI Explorer
        </h1>
        <button 
          onClick={handleApiKeySelection}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Change API Key
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-4">
        {state === AppState.IDLE && (
          <div className="text-center space-y-6 max-w-md">
            <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Identify Anything</h2>
              <p className="text-gray-400 mb-8 text-sm">Upload a photo of any city landmark to unlock its history with an immersive narrated guide.</p>
              
              <label className="block">
                <span className="sr-only">Choose landmark photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])}
                  className="block w-full text-sm text-gray-400
                    file:mr-4 file:py-3 file:px-6
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-600 file:text-white
                    hover:file:bg-blue-700
                    cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* Immersive View */}
        {(state !== AppState.IDLE && state !== AppState.ERROR) && (
          <div className="w-full h-full max-w-4xl relative rounded-3xl overflow-hidden shadow-2xl bg-gray-900 border border-gray-800 flex flex-col md:flex-row">
            {/* Image Section */}
            <div className="relative flex-1 bg-black">
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              )}
              
              {/* Overlay for Loading */}
              {state !== AppState.PLAYING && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <h3 className="text-lg font-semibold animate-pulse">
                    {state === AppState.LOADING_IMAGE && "Recognizing Landmark..."}
                    {state === AppState.SEARCHING_HISTORY && "Uncovering History..."}
                    {state === AppState.GENERATING_AUDIO && "Preparing Your Guide..."}
                  </h3>
                </div>
              )}

              {/* AR Tag Overlay (only when playing) */}
              {state === AppState.PLAYING && analysis && (
                <div className="absolute top-10 left-10 animate-bounce">
                  <div className="bg-blue-600/90 backdrop-blur px-4 py-2 rounded-lg border border-white/20 shadow-xl">
                    <span className="text-xs font-bold tracking-widest uppercase opacity-75">LOCATION</span>
                    <p className="font-bold text-lg">{analysis.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* History Section */}
            <div className="w-full md:w-96 bg-gray-900 p-6 flex flex-col h-full overflow-y-auto">
              {analysis ? (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-4">{analysis.name}</h2>
                    <div className="prose prose-invert prose-sm">
                      {analysis.history.split('\n').map((para, i) => (
                        <p key={i} className="mb-4 text-gray-300 leading-relaxed italic">
                          "{para}"
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-gray-800">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Sources & References</h3>
                    <ul className="space-y-2">
                      {analysis.sources.map((source, i) => (
                        <li key={i}>
                          <a 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-2 group"
                          >
                            <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={stopExperience}
                    className="mt-8 w-full bg-gray-800 hover:bg-gray-700 py-3 rounded-xl font-bold transition-colors"
                  >
                    Finish Tour
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-4">
                  <div className="w-12 h-1 border-t-2 border-gray-800 animate-pulse"></div>
                  <p className="text-xs uppercase tracking-widest">Awaiting Analysis</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {state === AppState.ERROR && (
          <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-3xl max-w-md text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-xl font-bold mb-2">Oops!</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => setState(AppState.IDLE)}
              className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-full font-bold"
            >
              Try Another Photo
            </button>
          </div>
        )}
      </main>

      {/* Persistent Call to Action */}
      {state === AppState.IDLE && (
        <footer className="p-8 text-center text-gray-500 text-xs">
          Built with Gemini AI & Google Search Grounding
        </footer>
      )}
    </div>
  );
};

export default App;
