import { z } from 'zod';
import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import {
  accountName,
  nameFields,
  type UserProfile,
} from '../../../../packages/shared/src/index.ts';
import { authDirectory, database } from './firebase.js';
import type { Principal } from './repository.js';
import { purchaseOwnerUid } from './purchase-ownership.js';

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}
export const profileNamesSchema = z
  .object({
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
  })
  .strict()
  .transform((names) => {
    let displayName: string;
    try {
      displayName = accountName(names.firstName, names.lastName);
    } catch {
      throw new ProfileError('Enter a valid first and last name.');
    }
    return { ...names, displayName };
  });
const profileSchema = z.object({
  uid: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[^/]+$/),
  email: z.email().nullable(),
  emailVerified: z.boolean(),
  displayName: z.string().max(200).nullable(),
  firstName: z.string().max(200),
  lastName: z.string().max(200),
  providerIds: z.array(z.string().min(1).max(100)).max(20),
  createdAt: z.iso.datetime(),
  lastSignInAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});
export interface ProfileDirectory {
  getUser(uid: string): Promise<{
    uid: string;
    email?: string;
    emailVerified: boolean;
    disabled: boolean;
    displayName?: string;
    metadata: { creationTime: string; lastSignInTime?: string };
    providerData: { providerId: string }[];
  }>;
}
export class UserProfiles {
  constructor(
    private db: Firestore = database(),
    private directory: ProfileDirectory = authDirectory(),
  ) {}
  private async identity(user: Principal) {
    const uid = profileSchema.shape.uid.parse(user.uid);
    const current = await this.directory.getUser(uid);
    if (current.uid !== uid || current.disabled)
      throw new ProfileError('Account access unavailable.', 401);
    return current;
  }
  async read(user: Principal): Promise<UserProfile | null> {
    await this.identity(user);
    const doc = await this.db.collection('users').doc(user.uid).get();
    if (!doc.exists) return null;
    const profile = profileSchema.parse(doc.data());
    if (profile.uid !== user.uid) throw new ProfileError('Profile ownership requires review.', 409);
    return profile;
  }
  async sync(
    user: Principal,
    names?: { firstName: string; lastName: string },
    claimGuests = true,
  ): Promise<UserProfile> {
    const current = await this.identity(user),
      now = new Date().toISOString();
    const fields = profileSchema.parse({
      uid: current.uid,
      email: current.email?.toLowerCase() ?? null,
      emailVerified: current.emailVerified,
      displayName: current.displayName ?? null,
      ...nameFields(current.displayName ?? null),
      providerIds: [...new Set(current.providerData.map((provider) => provider.providerId))].sort(),
      createdAt: new Date(current.metadata.creationTime).toISOString(),
      lastSignInAt: current.metadata.lastSignInTime
        ? new Date(current.metadata.lastSignInTime).toISOString()
        : null,
      updatedAt: now,
    });
    const profile = await this.db.runTransaction(async (t) => {
      const ref = this.db.collection('users').doc(user.uid),
        doc = await t.get(ref);
      if (doc.exists && doc.get('uid') !== user.uid)
        throw new ProfileError('Profile ownership requires review.', 409);
      const previous = profileSchema.safeParse(doc.data());
      if (names) {
        fields.firstName = names.firstName;
        fields.lastName = names.lastName;
        fields.displayName = accountName(names.firstName, names.lastName);
      } else if (previous.success && previous.data.displayName) {
        fields.firstName = previous.data.firstName;
        fields.lastName = previous.data.lastName;
        fields.displayName = previous.data.displayName;
      }
      if (
        previous.success &&
        JSON.stringify({ ...previous.data, updatedAt: now }) === JSON.stringify(fields)
      )
        return previous.data;
      t.set(ref, fields);
      return fields;
    });
    // Only current, verified Firebase identity can permanently claim guest data.
    if (
      claimGuests &&
      user.verified &&
      current.emailVerified &&
      fields.email &&
      user.email?.toLowerCase() === fields.email
    )
      await this.claimGuests(user.uid, fields.email);
    return profile;
  }
  async update(user: Principal, input: unknown): Promise<UserProfile> {
    const names = profileNamesSchema.parse(input);
    return this.sync(user, {
      firstName: names.firstName.replace(/\s+/g, ' '),
      lastName: names.lastName.replace(/\s+/g, ' '),
    });
  }
  private async claimGuests(uid: string, email: string) {
    // Bounded batches per sync; subsequent sign-ins/retries continue remaining work.
    const candidates = await this.db
      .collection('purchases')
      .where('email', '==', email)
      .where('uid', '==', null)
      .orderBy(FieldPath.documentId())
      .limit(25)
      .get();
    for (const purchase of candidates.docs)
      await this.db.runTransaction(async (t) => {
        const [parent, units] = await Promise.all([
          t.get(purchase.ref),
          t.get(this.db.collection('orders').where('parentOrderId', '==', purchase.id).limit(11)),
        ]);
        if (parent.get('uid') !== null || parent.get('email') !== email) return;
        if (units.size > 10) throw new ProfileError('Purchase ownership requires review.', 409);
        const activations = units.size
          ? await t.getAll(
              ...units.docs.map((unit) => this.db.collection('orderActivations').doc(unit.id)),
            )
          : [];
        const guestUid = purchaseOwnerUid(purchase.id, null);
        if (
          units.docs.some((unit) => unit.get('uid') !== guestUid) ||
          activations.some((doc) => doc.exists && doc.get('uid') !== guestUid)
        )
          throw new ProfileError('Purchase ownership requires review.', 409);
        t.update(purchase.ref, { uid, claimedAt: new Date().toISOString() });
        for (const unit of units.docs) t.update(unit.ref, { uid });
        for (const activation of activations)
          if (activation.exists) t.update(activation.ref, { uid });
      });
  }
}
