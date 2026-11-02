import mongoose, { ClientSession } from 'mongoose';

/**
 * Runs an operation inside a MongoDB transaction if supported (replica set / mongos).
 * If running on a standalone MongoDB instance (where transactions throw code 20 / IllegalOperation),
 * it gracefully falls back and executes the operation without a session/transaction.
 */
export async function runWithTransaction<T>(
  operation: (session?: ClientSession) => Promise<T>
): Promise<T> {
  let session: ClientSession | undefined;
  try {
    session = await mongoose.startSession();
  } catch {
    // If sessions cannot be created, execute directly
    return await operation(undefined);
  }

  try {
    let result: T;
    try {
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result!;
    } catch (txErr: unknown) {
      const err = txErr as { code?: number; codeName?: string; message?: string };
      const isUnsupported =
        err?.code === 20 ||
        err?.codeName === 'IllegalOperation' ||
        Boolean(err?.message?.includes('Transaction numbers are only allowed on a replica set member')) ||
        Boolean(err?.message?.includes('replica set'));

      if (isUnsupported) {
        // Fallback: execute operation without session/transaction for standalone MongoDB
        return await operation(undefined);
      }
      throw txErr;
    }
  } finally {
    try {
      await session.endSession();
    } catch {
      // Ignore session end error
    }
  }
}
