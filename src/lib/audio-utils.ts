import apiService from '@/lib/api-service';

let currentAudio: HTMLAudioElement | null = null;
let lastRequestId = 0;
let onPlaybackEnd: (() => void) | null = null;

/**
 * Stops any currently playing audio
 */
export const stopAudio = () => {
  if (currentAudio) {
    // const src = currentAudio.src;
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio = null;
  }
  if (onPlaybackEnd) {
    onPlaybackEnd();
    onPlaybackEnd = null;
  }
};

/**
 * Pauses currently playing audio
 */
export const pauseAudio = () => {
  if (currentAudio) {
    currentAudio.pause();
  }
};

/**
 * Resumes currently paused audio
 */
export const resumeAudio = async () => {
  if (currentAudio) {
    await currentAudio.play();
  }
};

/**
 * Fetches and plays TTS audio for a given text
 */
export const playTTS = async (text: string, language: string, sessionId: string, onEnd?: () => void) => {
  const requestId = ++lastRequestId;
  
  try {
    // Stop previous audio immediately
    stopAudio();
    onPlaybackEnd = onEnd || null;

    const response = await apiService.getTranscript(sessionId, text, language);
    
    // If a new request has started since we began fetching, don't play this one
    if (requestId !== lastRequestId) return;

    if (response.data.status === 'success' && response.data.audio_data) {
      const audioContent = response.data.audio_data;
      // Convert base64 to binary and create a blob URL (CSP-friendly)
      const binaryString = atob(audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      currentAudio = new Audio(audioUrl);
      currentAudio.onended = () => {
        if (onPlaybackEnd) {
          onPlaybackEnd();
          onPlaybackEnd = null;
        }
        currentAudio = null;
      };
      await currentAudio.play();
    } else {
      console.error("Failed to get TTS audio data");
      if (onPlaybackEnd) {
        onPlaybackEnd();
        onPlaybackEnd = null;
      }
    }
  } catch (error) {
    console.error("Error playing TTS:", error);
    if (onPlaybackEnd) {
      onPlaybackEnd();
      onPlaybackEnd = null;
    }
    throw error;
  }
};
