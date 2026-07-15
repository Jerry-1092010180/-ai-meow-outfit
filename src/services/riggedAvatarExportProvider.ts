import type { RiggedAvatarAsset, RiggedAvatarExportProvider, StylizedAvatar } from '@/types/avatarSystem';

export class GatewayRiggedAvatarExportProvider implements RiggedAvatarExportProvider {
  async export(avatar: StylizedAvatar): Promise<RiggedAvatarAsset> {
    if (!avatar.cdnUrl) throw new Error('Avatar has no rigged model URL');
    return {
      riggedModelUrl: avatar.cdnUrl,
      format: avatar.rig.format === 'vrm-ready' ? 'vrm-ready' : 'glb-rig-ready',
      skeletonMetadata: {
        skeleton: avatar.rig.skeleton === 'vrm-humanoid' ? 'vrm-humanoid' : 'humanoid-lite',
        boneCount: 20,
        skinnedMeshCount: 1,
        animationCount: avatar.rig.posePresets.filter((name) => name === 'idle' || name === 'confident-pose').length,
      },
      boneMap: {},
      animationClips: avatar.rig.posePresets,
      rigValidation: {
        ok: avatar.rig.format !== 'glb-static',
        errors: avatar.rig.format === 'glb-static' ? ['avatar_not_rigged'] : [],
        bones: 20,
        skinnedMeshes: avatar.rig.format === 'glb-static' ? 0 : 1,
        animations: avatar.rig.posePresets.length,
      },
      providerStage: 'local-humanoid-lite-rig-provider',
      confidence: avatar.rig.format === 'glb-static' ? 0 : 0.78,
    };
  }
}

export class FutureVrmRigProvider implements RiggedAvatarExportProvider {
  async export(): Promise<RiggedAvatarAsset> {
    throw new Error('FutureVrmRigProvider is not connected yet');
  }
}

export class AutoRigAigcProvider implements RiggedAvatarExportProvider {
  async export(): Promise<RiggedAvatarAsset> {
    throw new Error('AutoRigAigcProvider is not connected yet');
  }
}

export const riggedAvatarExportProvider = new GatewayRiggedAvatarExportProvider();
