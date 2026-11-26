export type GlobalId = string & { readonly globalId: unique symbol };
export type RevisionId = string & { readonly revisionId: unique symbol };
export type Sha256 = string & { readonly sha256: unique symbol };
export type OwnerApp = "storybook" | "comic" | "sandbox";

export type PinnedRecord<K extends string> = {
  workspaceId: GlobalId;
  id: GlobalId;
  revision: RevisionId;
  kind: K;
};

export type AssetDependency = {
  id: GlobalId;
  sha256: Sha256;
  byteLength: number;
  mediaType: string;
};

export type OwnedRevision<K extends string, T> = PinnedRecord<K> & {
  schemaVersion: number;
  ownerApp: OwnerApp;
  createdAt: string;
  previousRevision?: RevisionId;
  sources: readonly PinnedRecord<string>[];
  value: T;
};

export type WorkspaceAccess =
  | { kind: "private-snapshot"; ownerApp: OwnerApp }
  | { kind: "creative-library"; ownerApp: OwnerApp; readers: readonly OwnerApp[] };

export type AnatomyPart = {
  id: GlobalId;
  role: string;
  attachment?: GlobalId;
  notes?: string;
};

export type Anatomy = {
  bodyPlan: string;
  symmetry?: string;
  parts: readonly AnatomyPart[];
  capabilities?: readonly string[];
};

export type Appearance = {
  identity: string;
  features: readonly string[];
};

export type ReferenceSheet = {
  subject: PinnedRecord<"anatomy" | "appearance" | "outfit" | "character-look">;
  images: readonly { asset: AssetDependency; views: readonly string[] }[];
};

export type Outfit = {
  name: string;
  components: readonly string[];
  anatomyRequirements: readonly string[];
  referenceSheets: readonly PinnedRecord<"reference-sheet">[];
};

export type CharacterLook = {
  character: PinnedRecord<"character">;
  anatomy: PinnedRecord<"anatomy">;
  appearance: PinnedRecord<"appearance">;
  outfit?: PinnedRecord<"outfit">;
  equipment?: readonly PinnedRecord<"equipment">[];
  style?: PinnedRecord<"visual-style">;
  dressedReference?: PinnedRecord<"reference-sheet">;
};

export type PrivateAlbumSnapshot = {
  access: Extract<WorkspaceAccess, { kind: "private-snapshot" }>;
  schemaVersion: 1;
  albumId: GlobalId;
  revision: RevisionId;
  albumManifest: AssetDependency;
  dependencies: readonly AssetDependency[];
  sourceRevisions: readonly PinnedRecord<string>[];
};
