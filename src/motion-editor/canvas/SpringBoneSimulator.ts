interface SpringBoneState {
  tipX: number;
  tipY: number;
  velX: number;
  velY: number;
  initialized: boolean;
}

export interface PhysicsParams {
  stiffness: number;
  damping: number;
  gravity: number;
  maxAngle?: number;
}

export class SpringBoneSimulator {
  private states = new Map<string, SpringBoneState>();

  reset() {
    this.states.clear();
  }

  resetBone(id: string) {
    this.states.delete(id);
  }

  /**
   * Update spring physics for one bone. Returns the new local rotation in degrees.
   *
   * @param partId            Unique bone ID (used as state key)
   * @param boneLength        Distance from parent origin to this bone's origin
   * @param physics           Spring parameters
   * @param parentWorldX      Parent bone world X
   * @param parentWorldY      Parent bone world Y
   * @param parentWorldAngle  Parent bone world rotation in degrees
   * @param restTipX          Animated rest tip X (this bone's world X after anim solve)
   * @param restTipY          Animated rest tip Y (this bone's world Y after anim solve)
   * @param dt                Delta time in seconds
   */
  update(
    partId: string,
    boneLength: number,
    physics: PhysicsParams,
    parentWorldX: number,
    parentWorldY: number,
    parentWorldAngle: number,
    restTipX: number,
    restTipY: number,
    dt: number,
  ): number {
    const dtClamped = Math.min(dt, 0.05);

    let state = this.states.get(partId);
    if (!state || !state.initialized) {
      state = { tipX: restTipX, tipY: restTipY, velX: 0, velY: 0, initialized: true };
      this.states.set(partId, state);
      const worldAngle = Math.atan2(restTipY - parentWorldY, restTipX - parentWorldX) * (180 / Math.PI);
      return worldAngle - parentWorldAngle;
    }

    const { stiffness, damping, gravity } = physics;

    const fx = (restTipX - state.tipX) * stiffness - state.velX * damping;
    const fy = (restTipY - state.tipY) * stiffness - state.velY * damping + gravity;

    state.velX += fx * dtClamped;
    state.velY += fy * dtClamped;
    state.tipX += state.velX * dtClamped;
    state.tipY += state.velY * dtClamped;

    const tdx = state.tipX - parentWorldX;
    const tdy = state.tipY - parentWorldY;
    const dist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const scale = boneLength / dist;
    state.tipX = parentWorldX + tdx * scale;
    state.tipY = parentWorldY + tdy * scale;

    const worldAngleDeg = Math.atan2(state.tipY - parentWorldY, state.tipX - parentWorldX) * (180 / Math.PI);
    let localAngleDeg = worldAngleDeg - parentWorldAngle;

    if (physics.maxAngle != null) {
      const naturalWorldAngle = Math.atan2(restTipY - parentWorldY, restTipX - parentWorldX) * (180 / Math.PI);
      const naturalLocal = naturalWorldAngle - parentWorldAngle;
      let diff = localAngleDeg - naturalLocal;
      diff = ((diff + 180) % 360 + 360) % 360 - 180;
      const clamped = Math.max(-physics.maxAngle, Math.min(physics.maxAngle, diff));
      localAngleDeg = naturalLocal + clamped;
      const clampedWorldAngle = localAngleDeg + parentWorldAngle;
      const r = boneLength;
      state.tipX = parentWorldX + Math.cos(clampedWorldAngle * Math.PI / 180) * r;
      state.tipY = parentWorldY + Math.sin(clampedWorldAngle * Math.PI / 180) * r;
    }

    return localAngleDeg;
  }
}
