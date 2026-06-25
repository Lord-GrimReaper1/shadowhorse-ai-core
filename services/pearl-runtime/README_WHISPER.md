# Whisper Endpoint

This middleware exposes a simple Whisper transcription endpoint:

- `POST /v1/whisper` — Accepts `multipart/form-data` with field `audio` (file). Returns JSON `{ transcription, filename }`.

How to use (example using `curl`):

```bash
curl -X POST "http://localhost:4000/v1/whisper" \
  -F "audio=@/path/to/file.wav"
```

Unity Editor example: open `Crossroads → Whisper Upload Example` and select a local audio file.
