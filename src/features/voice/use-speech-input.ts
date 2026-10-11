import { useState } from 'react';
import {
  ExpoSpeechRecognitionErrorCode,
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const ERROR_MESSAGES: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'not-allowed': 'Izin mikrofon ditolak. Aktifkan di Pengaturan aplikasi.',
  'no-speech': 'Tidak ada ucapan yang terdengar. Coba lagi.',
  'speech-timeout': 'Tidak ada ucapan yang terdengar. Coba lagi.',
  network: 'Pengenalan suara butuh koneksi internet.',
  'language-not-supported': 'Bahasa Indonesia belum didukung layanan suara di perangkat ini.',
  'service-not-allowed': 'Layanan pengenalan suara tidak tersedia. Pastikan aplikasi Google aktif.',
  busy: 'Layanan suara sedang sibuk. Coba lagi sebentar.',
  'audio-capture': 'Mikrofon tidak bisa dipakai.',
};

/**
 * Speech-to-text in Indonesian (id-ID). The microphone permission is only
 * requested when the user starts listening for the first time.
 */
export const useSpeechInput = (onFinal: (transcript: string) => void) => {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setInterim('');
      onFinal(transcript);
    } else {
      setInterim(transcript);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error === 'aborted') return;
    setError(ERROR_MESSAGES[event.error] ?? `Pengenalan suara gagal (${event.error}).`);
  });

  const start = async () => {
    setError(null);
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError(ERROR_MESSAGES['service-not-allowed']!);
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError(ERROR_MESSAGES['not-allowed']!);
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: 'id-ID', interimResults: true, continuous: false });
  };

  const stop = () => ExpoSpeechRecognitionModule.stop();

  return { listening, interim, error, start, stop };
};
