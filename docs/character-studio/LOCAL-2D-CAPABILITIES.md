# Local 2D Generation Capabilities

Audit date: 2026-10-02 (Windows PC)

## Scope and method

Checked the known local ComfyUI installation at `D:\dev\ComfyUI`, its launch entry point, virtual-environment executables, API ports, built-in node source files, custom-node directory, and model folders relevant to character generation. Checked the ComfyUI API at `127.0.0.1:8188` and `127.0.0.1:8189`; neither responded and no ComfyUI process was running.

No software or model was installed, no server was started, and no changes were made to the ComfyUI installation. The audit did not search `.tmp-qa-data`, `node_modules`, `.git`, browser profiles/extensions, or build/output folders.

## AVAILABLE

| Capability | Evidence | Limits |
|---|---|---|
| ComfyUI installation | `D:\dev\ComfyUI\main.py` and `D:\dev\ComfyUI\venv\Scripts\python.exe` exist. | No root `run_cpu.bat` or `run_nvidia_gpu.bat` launcher was found. |
| Checkpoint files | `Counterfeit-V3.0_fp16.safetensors` (~4.2 GB), `v1-5-pruned-emaonly.safetensors` (~4.3 GB), and `svd.safetensors` (~9.6 GB) are present in `models\checkpoints`. | License, compatibility, and production-use approval were not established. |
| Core ControlNet node implementation | ComfyUI includes `comfy_extras\nodes_controlnet.py`. | No ControlNet weights are installed; see **MISSING**. |
| Pose preprocessing implementation | ComfyUI includes `comfy_extras\nodes_sdpose.py`. | No installed pose ControlNet model or live execution was verified. |
| Canny preprocessing | ComfyUI includes `comfy_extras\nodes_canny.py`. | This does not provide lineart or soft-edge preprocessing. |
| Depth node implementation | ComfyUI includes `comfy_extras\nodes_depth_anything_3.py`. | No depth model was found in the relevant model folders and the API was offline, so usable depth conditioning was not verified. |
| Background-removal node implementation | ComfyUI includes `comfy_extras\nodes_bg_removal.py`. | Required model weights are absent. |
| Upscale node implementations | ComfyUI includes `comfy_extras\nodes_sdupscale.py` and `nodes_upscale_model.py`. | No dedicated upscale-model weights are installed. |
| Matterhorn provider seam | Matterhorn already has a server-side `ComfyUIAssetProvider` used by Foundry and exposes the local provider's configured/available state to the Character Recipe page. | It is server-configured, loopback-only, and currently advertises `supportsReferences: false`. |
| Recipe preview path | Matterhorn can resolve/save prompt recipes without claiming an image was generated. A mock/preview provider is explicitly labeled and cannot approve generated images. | Preview mode does not synthesize an image or create Foundry evidence. |

## MISSING

- No model files are installed in `models\controlnet`, `models\loras`, `models\upscale_models`, `models\background_removal`, or `models\clip_vision`; each directory contains only its empty placement marker.
- No IP-Adapter node or model is installed. The `models\ipadapter` directory is absent, `models\clip_vision` has no weights, and the installed `nodes_ip2p.py` is not an IP-Adapter implementation.
- No lineart or soft-edge preprocessor source was found in the inspected ComfyUI built-in node set.
- No custom nodes are installed under `custom_nodes` (only the example and websocket-save files are present).
- No end-to-end ControlNet, OpenPose-guided generation, IP-Adapter/reference conditioning, lineart/soft-edge, background removal, or model-based upscale can be claimed with the currently installed weights.

## OPTIONAL

- Before generation, configure Matterhorn server-side with `MATTERHORN_COMFYUI_CHECKPOINT` and, if non-default, `MATTERHORN_COMFYUI_BASE_URL`. The default URL is `http://127.0.0.1:8188`.
- Review the selected checkpoint's license and record an approved license/provenance statement before treating generated work as shippable.
- Add task-specific ControlNet, IP-Adapter, pose, lineart/soft-edge, background-removal, upscale, and LoRA model packs only when a later slice requires them. No package or model installation was performed for this slice.

## BLOCKED

- **Live ComfyUI API:** unavailable at both checked local ports; no request could be submitted or completed.
- **Matterhorn-to-ComfyUI image generation on this PC:** blocked until ComfyUI is started, a checkpoint is configured in Matterhorn, and the checkpoint license is reviewed.
- **Reference-conditioned character generation:** blocked by the existing Matterhorn ComfyUI provider's `supportsReferences: false` capability and the absence of IP-Adapter/reference model assets.
- **Pose/depth/background-removal/upscale production use:** blocked by absent corresponding model weights (and, for lineart/soft-edge, absent preprocessor implementation).
- **Commercial/shippable use:** blocked until model and output provenance/licensing have been reviewed; the presence of local checkpoint files is not license evidence.

