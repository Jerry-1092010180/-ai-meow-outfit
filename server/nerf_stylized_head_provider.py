"""Five-view identity-preserving anime head reconstruction contracts.

This module intentionally contains orchestration and provider boundaries only.
Claude should implement each provider without moving model-specific code into
``avatar_server.py``. The browser talks to this pipeline through API Gateway;
the private AIGC machine performs every CUDA stage.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Awaitable, Callable, Literal, Protocol, Sequence


HeadScanPoseLabel = Literal["front", "left", "right", "up", "down"]
NeuralFieldBackend = Literal[
    "nerfacto-face-prior",
    "splatfacto-face-prior",
    "fdnerf-future",
]
ProgressCallback = Callable[["PipelineStage", float], Awaitable[None]]

REQUIRED_HEAD_SCAN_POSES: tuple[HeadScanPoseLabel, ...] = (
    "front",
    "left",
    "right",
    "up",
    "down",
)


class PipelineStage(str, Enum):
    PREPROCESSING = "preprocessing"
    CAMERA_SOLVING = "camera-solving"
    FACE_PRIOR_FITTING = "face-prior-fitting"
    IDENTITY_ENCODING = "identity-encoding"
    GEOMETRY_TRAINING = "geometry-training"
    ANIME_REFERENCE_GENERATION = "anime-reference-generation"
    STYLE_DISTILLATION = "style-distillation"
    MESH_EXTRACTION = "mesh-extraction"
    TEXTURE_BAKING = "texture-baking"
    VALIDATION = "validation"
    PUBLISHING = "publishing"


class StylizedHeadPipelineError(RuntimeError):
    def __init__(self, stage: PipelineStage, reason: str, errors: Sequence[str] = ()):
        super().__init__(reason)
        self.stage = stage
        self.reason = reason
        self.errors = list(errors)


@dataclass(frozen=True)
class HeadScanFrameInput:
    frame_id: str
    pose_label: HeadScanPoseLabel
    image_data_url: str
    quality_score: float
    mirrored: bool = False


@dataclass(frozen=True)
class NormalizedHeadFrame:
    frame_id: str
    pose_label: HeadScanPoseLabel
    image_path: Path
    foreground_mask_path: Path
    face_mask_path: Path
    hair_mask_path: Path
    landmarks_2d: tuple[tuple[float, float], ...]
    width: int
    height: int
    quality_score: float


@dataclass(frozen=True)
class SparseHeadCameraPose:
    frame_id: str
    pose_label: HeadScanPoseLabel
    camera_to_world: tuple[tuple[float, float, float, float], ...]
    focal_length_px: float
    principal_point: tuple[float, float]
    yaw_degrees: float
    pitch_degrees: float
    confidence: float


@dataclass(frozen=True)
class FaceGeometryPrior:
    provider: Literal["flame", "deca-flame", "mica-flame"]
    canonical_mesh_path: Path
    parameters_path: Path
    depth_prior_paths: tuple[Path, ...]
    normal_prior_paths: tuple[Path, ...]
    confidence: float


@dataclass(frozen=True)
class FaceIdentityEmbedding:
    provider: Literal["arcface", "insightface", "identity-encoder-future"]
    vector: tuple[float, ...]
    aggregate_strategy: Literal["quality-weighted-five-view"]
    per_view_similarity: dict[HeadScanPoseLabel, float]
    identity_features: dict[str, float | str | bool]
    confidence: float


@dataclass(frozen=True)
class CanonicalAnimeReference:
    image_path: Path
    provider: str
    prompt_version: str
    seed: int
    identity_similarity: float
    style_score: float


@dataclass(frozen=True)
class NeuralFieldArtifact:
    backend: NeuralFieldBackend
    stage: Literal["identity-neutral", "anime-stylized"]
    checkpoint_path: Path
    config_path: Path
    render_directory: Path
    metrics: dict[str, float]


@dataclass(frozen=True)
class StylizedHeadMeshArtifact:
    mesh_path: Path
    texture_path: Path | None
    preview_path: Path
    vertex_count: int
    triangle_count: int
    uv_ready: bool
    watertight_face_region: bool
    neck_seam_ready: bool
    coordinate_system: Literal["gltf-y-up-meters"] = "gltf-y-up-meters"


@dataclass(frozen=True)
class StylizedHeadValidationReport:
    ok: bool
    identity_score: float
    style_score: float
    geometry_score: float
    multiview_coverage_score: float
    texture_orientation_score: float
    errors: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class PublishedStylizedHeadAsset:
    mesh_url: str
    neural_field_url: str
    canonical_texture_url: str
    preview_url: str


@dataclass(frozen=True)
class NeuralFieldLossWeights:
    rgb: float = 1.0
    mask: float = 0.40
    perceptual: float = 0.25
    face_prior_depth: float = 0.35
    face_landmark: float = 0.25
    identity: float = 0.60
    multiview_consistency: float = 0.35
    geometry_regularization: float = 0.20
    anime_style: float = 0.30


@dataclass(frozen=True)
class AigcGpuTrainingConfig:
    backend: NeuralFieldBackend = "nerfacto-face-prior"
    device: str = "cuda:0"
    mixed_precision: bool = True
    max_iterations: int = 15_000
    output_mesh_format: Literal["glb"] = "glb"
    loss_weights: NeuralFieldLossWeights = field(default_factory=NeuralFieldLossWeights)


@dataclass(frozen=True)
class NerfStylizedHeadRequest:
    job_id: str
    identity_id: str
    frames: tuple[HeadScanFrameInput, ...]
    render_style: dict[str, object]
    workspace: Path
    training: AigcGpuTrainingConfig = field(default_factory=AigcGpuTrainingConfig)


@dataclass(frozen=True)
class NerfStylizedHeadResult:
    provider_stage: Literal["nerf-aigc-provider", "gaussian-splat-aigc-provider"]
    representation: Literal["neural-field+mesh+texture"]
    published: PublishedStylizedHeadAsset
    training_metrics: dict[str, float]
    identity_features: dict[str, float | str | bool]
    validation: StylizedHeadValidationReport
    confidence: float
    fallback_reason: str | None = None


class HeadScanPreprocessor(Protocol):
    async def normalize_head_scan_frames(
        self, frames: Sequence[HeadScanFrameInput], workspace: Path
    ) -> Sequence[NormalizedHeadFrame]: ...


class SparseHeadCameraSolver(Protocol):
    async def estimate_sparse_head_camera_poses(
        self, frames: Sequence[NormalizedHeadFrame]
    ) -> Sequence[SparseHeadCameraPose]: ...


class FaceGeometryPriorProvider(Protocol):
    async def fit_face_geometry_prior(
        self,
        frames: Sequence[NormalizedHeadFrame],
        cameras: Sequence[SparseHeadCameraPose],
        workspace: Path,
    ) -> FaceGeometryPrior: ...


class FaceIdentityEncoder(Protocol):
    async def extract_face_identity_embedding(
        self, frames: Sequence[NormalizedHeadFrame]
    ) -> FaceIdentityEmbedding: ...


class FewShotHeadNeuralFieldTrainer(Protocol):
    async def train_few_shot_head_neural_field(
        self,
        frames: Sequence[NormalizedHeadFrame],
        cameras: Sequence[SparseHeadCameraPose],
        geometry_prior: FaceGeometryPrior,
        identity: FaceIdentityEmbedding,
        config: AigcGpuTrainingConfig,
        workspace: Path,
    ) -> NeuralFieldArtifact: ...


class CanonicalAnimeReferenceProvider(Protocol):
    async def generate_canonical_anime_reference(
        self,
        front_frame: NormalizedHeadFrame,
        identity: FaceIdentityEmbedding,
        render_style: dict[str, object],
        workspace: Path,
    ) -> CanonicalAnimeReference: ...


class NeuralFieldAnimeStylizer(Protocol):
    async def distill_anime_style_into_neural_field(
        self,
        neutral_field: NeuralFieldArtifact,
        canonical_reference: CanonicalAnimeReference,
        identity: FaceIdentityEmbedding,
        render_style: dict[str, object],
        config: AigcGpuTrainingConfig,
        workspace: Path,
    ) -> NeuralFieldArtifact: ...


class StylizedHeadMeshExporter(Protocol):
    async def extract_stylized_head_mesh(
        self,
        stylized_field: NeuralFieldArtifact,
        geometry_prior: FaceGeometryPrior,
        workspace: Path,
    ) -> StylizedHeadMeshArtifact: ...

    async def bake_canonical_anime_texture(
        self,
        mesh: StylizedHeadMeshArtifact,
        stylized_field: NeuralFieldArtifact,
        canonical_reference: CanonicalAnimeReference,
        workspace: Path,
    ) -> StylizedHeadMeshArtifact: ...


class StylizedHeadAssetValidator(Protocol):
    async def validate_stylized_head_asset(
        self,
        mesh: StylizedHeadMeshArtifact,
        field: NeuralFieldArtifact,
        identity: FaceIdentityEmbedding,
        reference: CanonicalAnimeReference,
        frames: Sequence[NormalizedHeadFrame],
        cameras: Sequence[SparseHeadCameraPose],
    ) -> StylizedHeadValidationReport: ...


class StylizedHeadAssetPublisher(Protocol):
    async def publish_stylized_head_assets(
        self,
        job_id: str,
        mesh: StylizedHeadMeshArtifact,
        field: NeuralFieldArtifact,
        validation: StylizedHeadValidationReport,
    ) -> PublishedStylizedHeadAsset: ...


@dataclass(frozen=True)
class NerfStylizedHeadProviders:
    preprocessor: HeadScanPreprocessor
    camera_solver: SparseHeadCameraSolver
    geometry_prior: FaceGeometryPriorProvider
    identity_encoder: FaceIdentityEncoder
    field_trainer: FewShotHeadNeuralFieldTrainer
    anime_reference: CanonicalAnimeReferenceProvider
    field_stylizer: NeuralFieldAnimeStylizer
    mesh_exporter: StylizedHeadMeshExporter
    validator: StylizedHeadAssetValidator
    publisher: StylizedHeadAssetPublisher


class NerfStylizedHeadPipeline:
    """Strict orchestrator. Validation failure must never return a fake avatar."""

    def __init__(self, providers: NerfStylizedHeadProviders):
        self.providers = providers

    async def run_nerf_stylized_head_pipeline(
        self,
        request: NerfStylizedHeadRequest,
        on_progress: ProgressCallback | None = None,
    ) -> NerfStylizedHeadResult:
        self.validate_five_view_capture(request.frames)

        async def progress(stage: PipelineStage, value: float) -> None:
            if on_progress is not None:
                await on_progress(stage, value)

        await progress(PipelineStage.PREPROCESSING, 0.05)
        frames = await self.providers.preprocessor.normalize_head_scan_frames(
            request.frames, request.workspace
        )

        await progress(PipelineStage.CAMERA_SOLVING, 0.12)
        cameras = await self.providers.camera_solver.estimate_sparse_head_camera_poses(frames)

        await progress(PipelineStage.FACE_PRIOR_FITTING, 0.20)
        prior = await self.providers.geometry_prior.fit_face_geometry_prior(
            frames, cameras, request.workspace
        )

        await progress(PipelineStage.IDENTITY_ENCODING, 0.27)
        identity = await self.providers.identity_encoder.extract_face_identity_embedding(frames)

        await progress(PipelineStage.GEOMETRY_TRAINING, 0.34)
        neutral_field = await self.providers.field_trainer.train_few_shot_head_neural_field(
            frames,
            cameras,
            prior,
            identity,
            request.training,
            request.workspace,
        )

        front_frame = next(frame for frame in frames if frame.pose_label == "front")
        await progress(PipelineStage.ANIME_REFERENCE_GENERATION, 0.62)
        anime_reference = await self.providers.anime_reference.generate_canonical_anime_reference(
            front_frame,
            identity,
            request.render_style,
            request.workspace,
        )

        await progress(PipelineStage.STYLE_DISTILLATION, 0.68)
        stylized_field = await self.providers.field_stylizer.distill_anime_style_into_neural_field(
            neutral_field,
            anime_reference,
            identity,
            request.render_style,
            request.training,
            request.workspace,
        )

        await progress(PipelineStage.MESH_EXTRACTION, 0.84)
        mesh = await self.providers.mesh_exporter.extract_stylized_head_mesh(
            stylized_field, prior, request.workspace
        )

        await progress(PipelineStage.TEXTURE_BAKING, 0.90)
        textured_mesh = await self.providers.mesh_exporter.bake_canonical_anime_texture(
            mesh, stylized_field, anime_reference, request.workspace
        )

        await progress(PipelineStage.VALIDATION, 0.95)
        validation = await self.providers.validator.validate_stylized_head_asset(
            textured_mesh,
            stylized_field,
            identity,
            anime_reference,
            frames,
            cameras,
        )
        if not validation.ok:
            raise StylizedHeadPipelineError(
                PipelineStage.VALIDATION,
                "stylized_head_validation_failed",
                validation.errors,
            )

        await progress(PipelineStage.PUBLISHING, 0.98)
        published = await self.providers.publisher.publish_stylized_head_assets(
            request.job_id, textured_mesh, stylized_field, validation
        )

        await progress(PipelineStage.PUBLISHING, 1.0)
        provider_stage = (
            "gaussian-splat-aigc-provider"
            if request.training.backend == "splatfacto-face-prior"
            else "nerf-aigc-provider"
        )
        return NerfStylizedHeadResult(
            provider_stage=provider_stage,
            representation="neural-field+mesh+texture",
            published=published,
            training_metrics=stylized_field.metrics,
            identity_features=identity.identity_features,
            validation=validation,
            confidence=min(
                identity.confidence,
                anime_reference.identity_similarity,
                validation.identity_score,
                validation.geometry_score,
            ),
        )

    @staticmethod
    def validate_five_view_capture(frames: Sequence[HeadScanFrameInput]) -> None:
        labels = [frame.pose_label for frame in frames]
        errors: list[str] = []
        for pose in REQUIRED_HEAD_SCAN_POSES:
            count = labels.count(pose)
            if count == 0:
                errors.append(f"missing_pose:{pose}")
            elif count > 1:
                errors.append(f"duplicate_pose:{pose}")
        if len(frames) != 5:
            errors.append(f"expected_exactly_5_frames:received_{len(frames)}")
        if any(frame.quality_score < 0.55 for frame in frames):
            errors.append("capture_quality_below_0.55")
        if errors:
            raise StylizedHeadPipelineError(
                PipelineStage.PREPROCESSING,
                "invalid_five_view_capture",
                errors,
            )
