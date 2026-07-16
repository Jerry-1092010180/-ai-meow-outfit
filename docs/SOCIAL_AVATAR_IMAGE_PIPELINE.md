# Social Avatar Image Pipeline

## Product Rule

The primary asset is a persistent personal avatar, not a disposable outfit
recommendation. Every user owns one identity-driven avatar and can repeatedly
generate new images by changing garments, hairstyle, expression, pose, or
background.

## Single Avatar Request

The production request must contain:

1. User identity images and consent reference.
2. One approved Yintai PIM image for every selected garment slot.
3. Product and SKU identifiers for traceability.
4. Explicit layer order: inner, outerwear, base, shoes, accessory.
5. Hairstyle, expression, pose, and background controls.
6. A render policy requiring identity preservation, garment-design
   preservation, coherent layering, and full-body output.

The implementation contract is `StylizedAvatarImageRequest` in
`src/types/socialAvatar.ts`.

The provider must not silently return a template face. It must report:

- `providerStage`
- `identityConfidence`
- `garmentConsistency`
- `multiViewConsistency`
- `fallbackReason`

## Social Scene Rule

An invite never asks a friend to judge the host's outfit.

The invited friend must:

1. Create or load their own avatar identity.
2. Select their own complete Yintai outfit.
3. Generate their own avatar asset.
4. Join the host's scene as a separate member.

The scene provider receives only reusable member avatar assets plus interaction
controls. It returns a duo, trio, or four-person poster and leaves every
member's original avatar unchanged.

## Multi-member Invite Session

One scene owns one reusable invite URL. The link is not consumed after the
first friend joins.

1. The host creates a scene with one persistent avatar member.
2. The invite reserves two to four member seats and expires after a configured
   period.
3. Every friend opens the same link, creates or loads an independent avatar,
   selects a complete outfit, and joins one free seat.
4. The session stores the member list, background, interaction template, and
   latest generated poster.
5. Adding a member regenerates only the group scene. It never regenerates or
   overwrites an existing member avatar.
6. The room status is explicit: `open`, `full`, or `expired`.

The contracts are `SocialSceneInvite`, `SocialSceneSession`, and
`SocialScenePlatformProvider` in `src/types/socialAvatar.ts`. The browser Demo
provider persists sessions locally; production uses the Gateway provider.

## Required Production Endpoints

```text
POST /stylized-avatar/image
POST /stylized-avatar/social-scene
POST /stylized-avatar/social-scene/invites
POST /stylized-avatar/social-scene/invites/:inviteId/join
GET /stylized-avatar/social-scene/:sceneId
PATCH /stylized-avatar/social-scene/:sceneId
```

The H5 currently uses `DemoSocialAvatarImageProvider` and clearly marks its
visuals as effect previews. `GatewaySocialAvatarImageProvider` already preserves
the production API boundary.

## Product Inspiration

- Super QQ Show: photo-based avatar creation, face customization, fashion and
  virtual social spaces.
- QQ avatar expressions: persistent personal characters reused in chat content.
- QQ collaborative AI scenes: invite a friend's avatar to participate in the
  same generated story.

These patterns inform the interaction model only. The project must use original
visual assets, Yintai product data, and its own brand language.
