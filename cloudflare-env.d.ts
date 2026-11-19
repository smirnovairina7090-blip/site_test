declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    UNLOCK_CODE_HASHES?: string;
  }
}
