# Pickr Sidecar

Python CLI invoked as a subprocess by the Pickr Tauri backend for media
analysis: folder scanning, thumbnail generation, perceptual-hash dedup, and face
detection/matching.

All structured output is **newline-delimited JSON on stdout** (one object per
line). All logging goes to **stderr**.

## Setup

```bash
cd sidecar
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"          # core + test deps
pip install -e ".[dev,faces]"    # also install face_recognition (needs dlib/cmake)
```

`face_recognition` depends on `dlib`, which needs `cmake` and a C++ toolchain and
can be slow or fail to build. It is an **optional** extra (`faces`). Without it,
`scan` still runs (using an OpenCV Haar cascade for `face_count`), while
`face_detect`/`face_match` return empty results.

The `faces` extra also pins `setuptools < 81`: the legacy `face_recognition_models`
package imports `pkg_resources`, which setuptools 81+ no longer ships and Python
3.12+ venvs no longer bundle. If face features report as unavailable, check
`pip show setuptools` is below 81.

## Commands

```bash
pickr-sidecar scan <folder>
pickr-sidecar dedup <manifest_json_path>
pickr-sidecar face_detect <image_or_video_path>
pickr-sidecar face_match <embedding_b64> <manifest_json_path>
```

See `docs/ARCHITECTURE.md` (repo root) for the full CLI contract.

### scan

Non-recursive scan of a folder for media files (jpg, jpeg, png, heic, heif, mp4,
mov, avi, webm, mkv). Generates 320px-long-edge JPEG thumbnails into
`<folder>/.pickr/thumbs/` and caches results by source mtime in
`<folder>/.pickr/cache.json`.

Streams progress, then a final result:

```json
{"type": "progress", "done": 1, "total": 3, "current": "a.jpg"}
{"type": "result", "data": [ { "path": "/abs/a.jpg", "filename": "a.jpg",
  "kind": "image", "w": 4032, "h": 3024, "duration_sec": null, "sharpness": 7,
  "face_count": 2, "phash": "abc123…", "thumb_path": "/abs/.pickr/thumbs/a_thumb.jpg",
  "faces": [] } ] }
```

### dedup

Reads a manifest JSON (an array, or `{"data": [...]}`), groups items whose
pHashes are within Hamming distance ≤ 8, and adds `dup_group` (int) to each
member. Items with no near duplicate get `dup_group: null`.

### face_detect

Detects faces in an image (or a video's representative frame). Returns
`[{x, y, w, h, embedding_b64}]`. Empty list if `face_recognition` is unavailable.

### face_match

Compares a base64 embedding against the `faces[].embedding_b64` of every manifest
item; returns the `path`s whose cosine similarity exceeds 0.6.

## Tests

```bash
pytest
```
