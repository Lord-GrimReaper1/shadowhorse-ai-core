# Pearl Media Pipeline Scaffold

Pearl's media pipeline is designed to start local and open, then grow into a studio-owned media engine over time.

## Recommended Local Stack

1. ComfyUI Portable on the studio drive.
2. ComfyUI local API for Pearl automation.
3. Comfy CLI later for launch and workflow management.
4. LTX-Video workflows under the Comfy workflow library.
5. Unity and Blender rendering automation for deterministic previews.

## Pearl Runtime Contract

Pearl should treat ComfyUI as a local sidecar service. The first runtime layer only checks configuration, probes the local Comfy API, and lists approved workflow JSON files.

Pearl should not assume ComfyUI, models, or LTX assets are installed until the status tool confirms them.

## Suggested Drive Layout

```text
D:\Shadowhorse Games\
  shadowhorse-ai-core\
  Project Crossroads\
  Studio Tools\
    ComfyUI-Portable\
    Comfy-Outputs\
```

Workflow JSON files that Pearl is allowed to use should be copied into:

```text
services/pearl-runtime/media-workflows/
```

Large generated media and model checkpoints should remain outside Git.

## Near-Term Milestones

1. Install ComfyUI Portable.
2. Confirm the local Comfy API is reachable at `COMFY_BASE_URL`.
3. Add one image concept workflow JSON.
4. Add one LTX video workflow JSON.
5. Teach Pearl to queue approved workflows after human approval.
6. Record output provenance: prompt, workflow file, model/version, seed, source assets, output path, and timestamp.
