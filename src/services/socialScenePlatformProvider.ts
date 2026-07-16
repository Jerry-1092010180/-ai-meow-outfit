import type {
  CreateSocialSceneInviteInput,
  SocialAvatarMember,
  SocialSceneInvite,
  SocialScenePlatformProvider,
  SocialSceneSession,
} from '@/types/socialAvatar';

const STORAGE_KEY = 'aimm-social-scene-sessions-v1';

function readSessions(): Record<string, SocialSceneSession> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, SocialSceneSession>;
  } catch {
    return {};
  }
}

function writeSessions(sessions: Record<string, SocialSceneSession>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function statusFor(invite: SocialSceneInvite): SocialSceneInvite['status'] {
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return 'expired';
  if (invite.joinedCount >= invite.maxMembers) return 'full';
  return 'open';
}

export class DemoSocialScenePlatformProvider implements SocialScenePlatformProvider {
  async createInvite(input: CreateSocialSceneInviteInput): Promise<SocialSceneInvite> {
    const sessions = readSessions();
    const existing = sessions[input.sceneId];
    if (existing) return { ...existing.invite, status: statusFor(existing.invite) };

    const invite: SocialSceneInvite = {
      inviteId: `invite-${input.sceneId}`,
      sceneId: input.sceneId,
      inviteUrl: input.inviteUrl,
      hostMemberId: input.host.memberId,
      maxMembers: input.maxMembers,
      joinedCount: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'open',
    };
    sessions[input.sceneId] = {
      sceneId: input.sceneId,
      invite,
      members: [input.host],
      backgroundId: input.backgroundId,
      interactionId: input.interactionId,
      updatedAt: new Date().toISOString(),
    };
    writeSessions(sessions);
    return invite;
  }

  async getSession(sceneId: string): Promise<SocialSceneSession | null> {
    const session = readSessions()[sceneId];
    if (!session) return null;
    return {
      ...session,
      invite: { ...session.invite, status: statusFor(session.invite) },
    };
  }

  async joinInvite(inviteId: string, member: SocialAvatarMember): Promise<SocialSceneSession> {
    const sessions = readSessions();
    const session = Object.values(sessions).find((entry) => entry.invite.inviteId === inviteId);
    if (!session) throw new Error('Social scene invite not found.');

    const status = statusFor(session.invite);
    if (status !== 'open') throw new Error(`Social scene invite is ${status}.`);

    const members = session.members.some((entry) => entry.memberId === member.memberId)
      ? session.members
      : [...session.members, member];
    const next: SocialSceneSession = {
      ...session,
      members,
      invite: {
        ...session.invite,
        joinedCount: members.length,
        status: members.length >= session.invite.maxMembers ? 'full' : 'open',
      },
      updatedAt: new Date().toISOString(),
    };
    sessions[session.sceneId] = next;
    writeSessions(sessions);
    return next;
  }

  async updateScene(
    sceneId: string,
    patch: Pick<SocialSceneSession, 'backgroundId' | 'interactionId'>
  ): Promise<SocialSceneSession> {
    const sessions = readSessions();
    const session = sessions[sceneId];
    if (!session) throw new Error('Social scene session not found.');
    const next = { ...session, ...patch, updatedAt: new Date().toISOString() };
    sessions[sceneId] = next;
    writeSessions(sessions);
    return next;
  }
}

export class GatewaySocialScenePlatformProvider implements SocialScenePlatformProvider {
  constructor(private readonly endpoint: string) {}

  async createInvite(input: CreateSocialSceneInviteInput): Promise<SocialSceneInvite> {
    const response = await fetch(`${this.endpoint}/stylized-avatar/social-scene/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`Create social invite failed: ${response.status}`);
    return response.json() as Promise<SocialSceneInvite>;
  }

  async getSession(sceneId: string): Promise<SocialSceneSession | null> {
    const response = await fetch(`${this.endpoint}/stylized-avatar/social-scene/${sceneId}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Get social scene failed: ${response.status}`);
    return response.json() as Promise<SocialSceneSession>;
  }

  async joinInvite(inviteId: string, member: SocialAvatarMember): Promise<SocialSceneSession> {
    const response = await fetch(
      `${this.endpoint}/stylized-avatar/social-scene/invites/${inviteId}/join`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member }),
      }
    );
    if (!response.ok) throw new Error(`Join social scene failed: ${response.status}`);
    return response.json() as Promise<SocialSceneSession>;
  }

  async updateScene(
    sceneId: string,
    patch: Pick<SocialSceneSession, 'backgroundId' | 'interactionId'>
  ): Promise<SocialSceneSession> {
    const response = await fetch(`${this.endpoint}/stylized-avatar/social-scene/${sceneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error(`Update social scene failed: ${response.status}`);
    return response.json() as Promise<SocialSceneSession>;
  }
}

const gatewayBase = import.meta.env.VITE_AVATAR_API_BASE_URL as string | undefined;

export const socialScenePlatformProvider: SocialScenePlatformProvider = gatewayBase
  ? new GatewaySocialScenePlatformProvider(gatewayBase)
  : new DemoSocialScenePlatformProvider();
