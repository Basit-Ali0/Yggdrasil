// ============================================================
// POST /api/scan/rescan — Same contract as POST /api/scan/run
// UI and clients may call this when re-running a scan with the
// same audit/upload/mapping; dedicated violation diff is future work.
// ============================================================

export { POST } from '../run/route';
