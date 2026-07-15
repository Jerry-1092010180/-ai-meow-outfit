# Stylized Avatar Pipeline

This project is now an identity-driven stylized avatar platform.

The product path is not full-body photogrammetry, silhouette carving, mannequin fitting, or realistic human reconstruction. Those paths may remain as legacy fallback code, but they are not the user-facing core experience.

## Product Goal

The main goal is to let a mobile user capture a few guided face angles and receive a recognizable, beautified, comic-animation-style 3D character that can later support outfits, poses, expressions, social sharing, duo scenes, and VRM export.

Identity comes from the face. The body is a unified stylized character shell. The renderer should prioritize strong graphic language: outlines, toon lighting, hard shadow bands, high-contrast color blocks, and optional halftone overlays.

## Main Pipeline

```text
guided head scan frames
  -> FaceIdentity
  -> AvatarIdentity
  -> AvatarAppearance + AvatarOutfit + AvatarRenderStyle
  -> StylizedAvatarProvider
  -> rig-friendly GLB now, VRM later
  -> GLBModelViewer with toon / outline / halftone presentation
```

## Core Domain Objects

- `FaceIdentity`: captured face frames, primary face frame, confidence, and identity preservation notes.
- `AvatarIdentity`: stable identity object created from face capture.
- `AvatarRenderStyle`: visual language such as American comic 3D, toon shading, outline, halftone, and palette.
- `AvatarAppearance`: render style plus light body/style preferences.
- `AvatarOutfit`: clothing hook for Yintai catalog or procedural demo outfits.
- `AvatarRig`: export target and animation capability, from static GLB to VRM-ready.
- `StylizedAvatar`: final product object consumed by the UI.

## Provider Boundary

Current implementation:

- `BrowserFaceIdentityProvider`: creates a browser-side identity object from guided head-scan frames.
- `LocalExperimentalStylizedHeadProvider`: aggregates guided head-scan frames, creates a comic-posterized face texture, estimates identity features, and emits head fitting parameters. This is a real local experimental provider, not a final industrial model.
- `AigcStylizedAvatarProvider`: sends identity, style, outfit, and frame payload through the existing API Gateway to the private AIGC machine.
- `server/avatar_server.py`: procedural mock provider that generates an anime-stylized character GLB.

Future provider replacements should target these interfaces:

- `FaceIdentityProvider`
- `StylizedHeadProvider`
- `StylizedAvatarProvider`
- `RiggedAvatarExportProvider`

## Legacy Downgrade

The following are legacy fallback only:

- `guided-360-phone-stand`
- `CaptureFrame` full-body capture
- `silhouettes_to_voxel_mesh`
- `create_parametric_body`
- `store-mannequin-parametric-avatar`

They should not shape the main product UX. Do not optimize them as the primary path unless explicitly working on a fallback.

## Near-Term Roadmap

1. Replace `LocalExperimentalStylizedHeadProvider` with a real identity-preserving stylized head provider.
2. Export rigged GLB with humanoid-lite skeleton.
3. Add VRM export provider.
4. Attach Yintai catalog outfits as swappable avatar outfits.
5. Add pose presets and expression blendshapes in the viewer.

## StylizedHeadProvider P0

The head provider is the highest-priority module because "looks like the user" is more important than body reconstruction.

Input:

- guided head scan frames: front, left, right, up, down
- `AvatarIdentity`
- `AvatarRenderStyle`

Output:

- `StylizedHead`
- `textureDataUrl`: comic-stylized face texture
- `identityFeatures`: face box derived proportions, skin tone, hair tone, pose coverage
- `headFit`: scale and fitting parameters for the unified character head template
- explicit provider stage and confidence

Current capability:

- real aggregation of multi-angle frame coverage
- real local texture stylization using brightness/contrast, posterization, elliptical mask, and comic outline
- real payload handoff to AIGC provider

Current limitations:

- no learned face embedding
- no true 3DMM/FLAME head mesh
- no learned identity-preserving anime head generation yet
- no side-view geometry reconstruction yet

Fallback must be labeled. A generic template face must never be represented as a personalized result.

## RiggedAvatarExportProvider P0-2

The current rig provider is `LocalHumanoidLiteRigProvider` on the AIGC server, with a frontend bridge named `GatewayRiggedAvatarExportProvider`.

It exports a real skinned GLB:

- fixed humanoid-lite bone hierarchy
- `skins[0]` with 20 joints
- inverse bind matrices
- `JOINTS_0` and `WEIGHTS_0`
- deterministic vertex weights by anatomical part
- one skinned mesh
- animation clips: `idle`, `confident-pose`

Minimum bone hierarchy:

```text
Root
└── Hips
    ├── Spine
    │   └── Chest
    │       ├── Neck
    │       │   └── Head
    │       ├── LeftShoulder
    │       │   └── LeftUpperArm
    │       │       └── LeftLowerArm
    │       │           └── LeftHand
    │       └── RightShoulder
    │           └── RightUpperArm
    │               └── RightLowerArm
    │                   └── RightHand
    ├── LeftUpperLeg
    │   └── LeftLowerLeg
    │       └── LeftFoot
    └── RightUpperLeg
        └── RightLowerLeg
            └── RightFoot
```

Validation is mandatory. If rig validation fails, the provider returns `rig_validation_failed` instead of silently falling back to a static mesh.

Current limitation:

- skinning is mostly rigid per stylized body part, with stable deterministic weights
- not full production deformation yet
- VRM metadata is compatibility-oriented, not a complete VRM export
