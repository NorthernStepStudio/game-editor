import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export interface MatterhornAssetLeaseHolder {
  readonly agentId: string;
  readonly runId: string;
  readonly taskId: string;
}

export interface MatterhornAssetLease {
  readonly path: string;
  readonly holder: MatterhornAssetLeaseHolder;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly acquiredHash?: string;
}

export interface MatterhornTrackedAsset {
  readonly path: string;
  readonly hash?: string;
  readonly updatedAt: string;
}

export type MatterhornAssetVerificationState =
  | "ok"
  | "missing"
  | "changed-unlocked"
  | "locked-unchanged"
  | "locked-modified";

export interface MatterhornAssetVerification {
  readonly path: string;
  readonly state: MatterhornAssetVerificationState;
  readonly expectedHash?: string;
  readonly actualHash?: string;
  readonly holder?: MatterhornAssetLeaseHolder;
  readonly expiresAt?: string;
}

interface AssetLeaseState {
  version: 1;
  tracked: MatterhornTrackedAsset[];
  leases: MatterhornAssetLease[];
}

export interface MatterhornAssetLeaseStoreOptions {
  readonly projectRoot: string;
  readonly stateFile: string;
  readonly minLeaseMs?: number;
  readonly maxLeaseMs?: number;
}

function validIdentity(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value);
}

function sameHolder(a: MatterhornAssetLeaseHolder, b: MatterhornAssetLeaseHolder): boolean {
  return a.agentId === b.agentId && a.runId === b.runId && a.taskId === b.taskId;
}

function normalizeAssetPath(value: string): string {
  if (!value || value.length > 2_000 || isAbsolute(value) || /[\0\r\n]/.test(value)) {
    throw new Error("Asset path must be a bounded project-relative path.");
  }
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  const parts = normalized.split("/");
  if (!parts.length || parts.some(part => !part || part === "." || part === "..")) {
    throw new Error("Asset path cannot contain empty, current-directory, or parent-directory segments.");
  }
  return parts.join("/");
}

function validateHolder(holder: MatterhornAssetLeaseHolder): void {
  if (!validIdentity(holder.agentId) || !validIdentity(holder.runId) || !validIdentity(holder.taskId)) {
    throw new Error("Invalid asset lease holder identity.");
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function sha256File(path: string): Promise<string | undefined> {
  if (!await exists(path)) return undefined;
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function validateState(raw: unknown): AssetLeaseState {
  if (!raw || typeof raw !== "object") throw new Error("Asset lease state is invalid.");
  const candidate = raw as Partial<AssetLeaseState>;
  if (candidate.version !== 1 || !Array.isArray(candidate.tracked) || !Array.isArray(candidate.leases)) {
    throw new Error("Asset lease state is invalid.");
  }
  for (const tracked of candidate.tracked) {
    normalizeAssetPath(tracked.path);
    if (tracked.hash != null && !/^[0-9a-f]{64}$/.test(tracked.hash)) throw new Error("Tracked asset hash is invalid.");
    if (!Number.isFinite(new Date(tracked.updatedAt).valueOf())) throw new Error("Tracked asset timestamp is invalid.");
  }
  for (const lease of candidate.leases) {
    normalizeAssetPath(lease.path);
    validateHolder(lease.holder);
    if (lease.acquiredHash != null && !/^[0-9a-f]{64}$/.test(lease.acquiredHash)) throw new Error("Asset lease hash is invalid.");
    if (!Number.isFinite(new Date(lease.acquiredAt).valueOf()) || !Number.isFinite(new Date(lease.expiresAt).valueOf())) {
      throw new Error("Asset lease timestamp is invalid.");
    }
  }
  return {
    version: 1,
    tracked: candidate.tracked.map(item => ({ ...item })),
    leases: candidate.leases.map(item => ({ ...item, holder: { ...item.holder } })),
  };
}

export class MatterhornAssetLeaseStore {
  private readonly projectRoot: string;
  private readonly stateFile: string;
  private readonly minLeaseMs: number;
  private readonly maxLeaseMs: number;
  private loaded?: Promise<void>;
  private state: AssetLeaseState = { version: 1, tracked: [], leases: [] };
  private operations = Promise.resolve();

  constructor(options: MatterhornAssetLeaseStoreOptions) {
    if (!isAbsolute(options.projectRoot) || !isAbsolute(options.stateFile)) {
      throw new Error("Asset lease project root and state file must be absolute paths.");
    }
    this.projectRoot = resolve(options.projectRoot);
    this.stateFile = resolve(options.stateFile);
    this.minLeaseMs = options.minLeaseMs ?? 5_000;
    this.maxLeaseMs = options.maxLeaseMs ?? 2 * 60 * 60 * 1_000;
    if (!Number.isFinite(this.minLeaseMs) || !Number.isFinite(this.maxLeaseMs) ||
        this.minLeaseMs < 1_000 || this.maxLeaseMs < this.minLeaseMs || this.maxLeaseMs > 24 * 60 * 60 * 1_000) {
      throw new Error("Invalid asset lease duration bounds.");
    }
  }

  async acquire(path: string, holder: MatterhornAssetLeaseHolder, leaseMs: number): Promise<MatterhornAssetLease> {
    return this.serial(async () => {
      await this.ensureLoaded();
      validateHolder(holder);
      const relativePath = normalizeAssetPath(path);
      this.validateLeaseDuration(leaseMs);
      await this.resolveConfined(relativePath);
      const changed = this.purgeExpired();

      const existing = this.state.leases.find(lease => lease.path === relativePath);
      if (existing) {
        if (changed) await this.persist();
        throw new Error(
          `Asset is already leased by ${existing.holder.agentId} for run ${existing.holder.runId} task ${existing.holder.taskId} until ${existing.expiresAt}.`,
        );
      }

      const absolutePath = resolve(this.projectRoot, ...relativePath.split("/"));
      const currentHash = await sha256File(absolutePath);
      const tracked = this.state.tracked.find(item => item.path === relativePath);
      if (tracked && tracked.hash !== currentHash) {
        if (changed) await this.persist();
        throw new Error("Asset changed outside the tracked lease workflow. Verify or rebaseline it before editing.");
      }

      const now = new Date();
      const lease: MatterhornAssetLease = {
        path: relativePath,
        holder: { ...holder },
        acquiredAt: now.toISOString(),
        expiresAt: new Date(now.valueOf() + leaseMs).toISOString(),
        ...(currentHash ? { acquiredHash: currentHash } : {}),
      };
      if (!tracked) {
        this.state.tracked.push({
          path: relativePath,
          ...(currentHash ? { hash: currentHash } : {}),
          updatedAt: now.toISOString(),
        });
      }
      this.state.leases.push(lease);
      await this.persist();
      return structuredClone(lease);
    });
  }

  async renew(path: string, holder: MatterhornAssetLeaseHolder, leaseMs: number): Promise<MatterhornAssetLease> {
    return this.serial(async () => {
      await this.ensureLoaded();
      validateHolder(holder);
      const relativePath = normalizeAssetPath(path);
      this.validateLeaseDuration(leaseMs);
      this.purgeExpired();
      const index = this.state.leases.findIndex(lease => lease.path === relativePath);
      if (index === -1) throw new Error("Asset lease is not active.");
      const lease = this.state.leases[index];
      if (!sameHolder(lease.holder, holder)) throw new Error("Only the current asset lease holder can renew it.");
      const renewed = { ...lease, expiresAt: new Date(Date.now() + leaseMs).toISOString() };
      this.state.leases[index] = renewed;
      await this.persist();
      return structuredClone(renewed);
    });
  }

  async release(path: string, holder: MatterhornAssetLeaseHolder): Promise<MatterhornTrackedAsset> {
    return this.serial(async () => {
      await this.ensureLoaded();
      validateHolder(holder);
      const relativePath = normalizeAssetPath(path);
      await this.resolveConfined(relativePath);
      this.purgeExpired();
      const index = this.state.leases.findIndex(lease => lease.path === relativePath);
      if (index === -1) throw new Error("Asset lease is not active.");
      const lease = this.state.leases[index];
      if (!sameHolder(lease.holder, holder)) throw new Error("Only the current asset lease holder can release it.");

      const absolutePath = resolve(this.projectRoot, ...relativePath.split("/"));
      const hash = await sha256File(absolutePath);
      const tracked: MatterhornTrackedAsset = {
        path: relativePath,
        ...(hash ? { hash } : {}),
        updatedAt: new Date().toISOString(),
      };
      const trackedIndex = this.state.tracked.findIndex(item => item.path === relativePath);
      if (trackedIndex === -1) this.state.tracked.push(tracked);
      else this.state.tracked[trackedIndex] = tracked;
      this.state.leases.splice(index, 1);
      await this.persist();
      return structuredClone(tracked);
    });
  }

  async rebaseline(path: string): Promise<MatterhornTrackedAsset> {
    return this.serial(async () => {
      await this.ensureLoaded();
      const relativePath = normalizeAssetPath(path);
      await this.resolveConfined(relativePath);
      this.purgeExpired();
      if (this.state.leases.some(lease => lease.path === relativePath)) {
        throw new Error("Cannot rebaseline an asset while it is leased.");
      }
      const hash = await sha256File(resolve(this.projectRoot, ...relativePath.split("/")));
      const tracked: MatterhornTrackedAsset = {
        path: relativePath,
        ...(hash ? { hash } : {}),
        updatedAt: new Date().toISOString(),
      };
      const index = this.state.tracked.findIndex(item => item.path === relativePath);
      if (index === -1) this.state.tracked.push(tracked);
      else this.state.tracked[index] = tracked;
      await this.persist();
      return structuredClone(tracked);
    });
  }

  async status(): Promise<readonly MatterhornAssetLease[]> {
    return this.serial(async () => {
      await this.ensureLoaded();
      if (this.purgeExpired()) await this.persist();
      return this.state.leases.map(lease => structuredClone(lease));
    });
  }

  async verify(): Promise<readonly MatterhornAssetVerification[]> {
    return this.serial(async () => {
      await this.ensureLoaded();
      const changed = this.purgeExpired();
      if (changed) await this.persist();
      const output: MatterhornAssetVerification[] = [];
      for (const tracked of this.state.tracked) {
        await this.resolveConfined(tracked.path);
        const actualHash = await sha256File(resolve(this.projectRoot, ...tracked.path.split("/")));
        const lease = this.state.leases.find(item => item.path === tracked.path);
        const state: MatterhornAssetVerificationState = lease
          ? actualHash === lease.acquiredHash ? "locked-unchanged" : "locked-modified"
          : actualHash === undefined ? "missing"
            : actualHash === tracked.hash ? "ok" : "changed-unlocked";
        output.push({
          path: tracked.path,
          state,
          ...(tracked.hash ? { expectedHash: tracked.hash } : {}),
          ...(actualHash ? { actualHash } : {}),
          ...(lease ? { holder: { ...lease.holder }, expiresAt: lease.expiresAt } : {}),
        });
      }
      return output;
    });
  }

  private validateLeaseDuration(leaseMs: number): void {
    if (!Number.isInteger(leaseMs) || leaseMs < this.minLeaseMs || leaseMs > this.maxLeaseMs) {
      throw new Error(`Asset lease duration must be between ${this.minLeaseMs} and ${this.maxLeaseMs} ms.`);
    }
  }

  private purgeExpired(): boolean {
    const now = Date.now();
    const before = this.state.leases.length;
    this.state.leases = this.state.leases.filter(lease => new Date(lease.expiresAt).valueOf() > now);
    return before !== this.state.leases.length;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) this.loaded = this.load();
    return this.loaded;
  }

  private async load(): Promise<void> {
    await mkdir(dirname(this.stateFile), { recursive: true });
    try {
      this.state = validateState(JSON.parse(await readFile(this.stateFile, "utf8")));
      this.purgeExpired();
      await this.persist();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.stateFile), { recursive: true });
    const temp = `${this.stateFile}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temp, JSON.stringify(this.state, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    await rename(temp, this.stateFile);
  }

  private async resolveConfined(relativePath: string): Promise<string> {
    const rootReal = await realpath(this.projectRoot);
    const target = resolve(this.projectRoot, ...relativePath.split("/"));
    const rel = relative(this.projectRoot, target);
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error("Asset path escapes the project root.");
    }

    if (await exists(target)) {
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isFile()) throw new Error("Asset path must refer to a regular file.");
      const targetReal = await realpath(target);
      const realRel = relative(rootReal, targetReal);
      if (!realRel || realRel === ".." || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) {
        throw new Error("Asset path escapes the real project root.");
      }
      return targetReal;
    }

    const parentReal = await realpath(dirname(target));
    const parentRel = relative(rootReal, parentReal);
    if (parentRel === ".." || parentRel.startsWith(`..${sep}`) || isAbsolute(parentRel)) {
      throw new Error("Asset parent escapes the real project root.");
    }
    return target;
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.operations.then(operation, operation);
    this.operations = run.then(() => undefined, () => undefined);
    return run;
  }
}
