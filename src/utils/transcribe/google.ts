import { convertAudioToRaw } from "./helpers/ffmpeg";
const { PassThrough } = require("stream");
import { put } from "./helpers/gStorage";
import fetch from "node-fetch";
import { bindLog } from "../log";

const googleKey = JSON.parse(process.env.GC_CREDENTIALS)

let l = bindLog(__dirname, __filename);

// Imports the Google Cloud client library
const speech = require("@google-cloud/speech").v1p1beta1

// Creates a client
const client = new speech.SpeechClient({
  credentials: googleKey,
});

async function googleSpeech(gcsUri, language) {
  // The path to the remote LINEAR16 file
  // The audio file's encoding, sample rate in hertz, and BCP-47 language code
  const audio = {
    uri: gcsUri,
  };
  const config = {
    encoding: "LINEAR16",
    sampleRateHertz: 16000,
    languageCode: language,
    alternativeLanguageCodes: ['es-AR', 'es-VE', 'es-US', 'en-US'],
  }
  const request = {
    audio: audio,
    config: config,
  };

  // Detects speech in the audio file
  const [operation] = await client.longRunningRecognize(request);

  const [response] = await operation.promise();

  const transcription = response.results
    .map((result) => result.alternatives[0].transcript)
    .join("");
  response.transcription = transcription;

  return response;
}

export async function transcribe(voiceStream) {
  const pass = new PassThrough();
  let response;

  response = await fetch(voiceStream, {});

  convertAudioToRaw(response.body, pass);

  const rawFileName = `${process.env.TEMP_STORAGE_FOLDER}/${new Date().getTime()}.flac`;

  await put("r3js", rawFileName, pass);

  try {
    return await googleSpeech(`gs://${process.env.GC_BUCKET}/${rawFileName}`, "en-US")
  } catch (err) {
    l.err("err", err);
  }
}
