import { readFileSync } from 'fs';
import { join } from 'path';
import { safeNextPath } from '../auth-redirect';
import { redactSecrets } from '../gemini';
import { canAssignOrganizationRole, isSelfOwnershipDowngrade } from '../org-management';
import { clampImportLimit, parseOrganizationEventsLimit } from '../request-limits';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
    if (condition) {
        console.log(`  OK ${name}`);
        passed++;
    } else {
        console.error(`  FAIL ${name}`);
        failed++;
    }
}

console.log('\n-- SaaS org closeout: role assignment --');
assert(!canAssignOrganizationRole('admin', 'owner'), 'admin cannot assign owner');
assert(!canAssignOrganizationRole('admin', 'admin'), 'admin cannot assign admin');
assert(canAssignOrganizationRole('admin', 'member'), 'admin can assign member');
assert(canAssignOrganizationRole('owner', 'owner'), 'owner can assign owner');
assert(canAssignOrganizationRole('owner', 'admin'), 'owner can assign admin');
assert(canAssignOrganizationRole('owner', 'member'), 'owner can assign member');
assert(isSelfOwnershipDowngrade('u1', 'u1', 'admin'), 'self ownership downgrade is rejected');
assert(!isSelfOwnershipDowngrade('u2', 'u1', 'admin'), 'transfer to another user can downgrade current owner');
assert(!isSelfOwnershipDowngrade('u1', 'u1', null), 'self ownership transfer without downgrade is not a downgrade');

console.log('\n-- SaaS org closeout: login redirect safety --');
assert(safeNextPath('/invite/accept?token=abc') === '/invite/accept?token=abc', 'keeps internal invite next path');
assert(safeNextPath('/audit/new') === '/audit/new', 'keeps internal app path');
assert(safeNextPath('https://evil.example/invite') === '/audit/new', 'rejects absolute external URL');
assert(safeNextPath('//evil.example/invite') === '/audit/new', 'rejects protocol-relative URL');
assert(safeNextPath('') === '/audit/new', 'falls back for empty next');

console.log('\n-- SaaS org closeout: event and import limits --');
assert(parseOrganizationEventsLimit(null) === 50, 'event limit defaults to 50');
assert(parseOrganizationEventsLimit('nope') === 50, 'event limit handles NaN');
assert(parseOrganizationEventsLimit('-1') === 50, 'event limit handles negative');
assert(parseOrganizationEventsLimit('250') === 100, 'event limit clamps max 100');
assert(parseOrganizationEventsLimit('10.9') === 10, 'event limit truncates decimals');
assert(clampImportLimit(undefined) === 50000, 'postgres import limit defaults');
assert(clampImportLimit(0) === 1, 'postgres import limit clamps minimum');
assert(clampImportLimit(250000) === 100000, 'postgres import limit clamps maximum');

console.log('\n-- SaaS org closeout: Gemini redaction --');
assert(redactSecrets('api_key: secret123') === 'api_key: [REDACTED]', 'redacts api_key colon format');
assert(redactSecrets('api_key=secret123') === 'api_key=[REDACTED]', 'redacts api_key equals format');
assert(redactSecrets('"api_key": "secret123"') === '"api_key": [REDACTED]', 'redacts quoted json api_key');
assert(redactSecrets("'api_key': 'secret123'") === "'api_key': [REDACTED]", 'redacts single-quoted api_key');
assert(redactSecrets('key AIza12345678901234567890') === 'key [REDACTED_GEMINI_API_KEY]', 'redacts Gemini key prefix');

console.log('\n-- SaaS org closeout: migration self-contained helpers --');
const migration = readFileSync(
    join(process.cwd(), 'knowledge/migrations/2026-05-15-saas-org-management.sql'),
    'utf8',
);
assert(
    /CREATE OR REPLACE FUNCTION public\.current_user_org_ids\(\)/.test(migration),
    'migration defines current_user_org_ids',
);
assert(
    /GRANT EXECUTE ON FUNCTION public\.current_user_org_ids\(\) TO authenticated;/.test(migration),
    'migration grants current_user_org_ids',
);
assert(
    /WITH CHECK \(public\.current_user_is_org_admin\(organization_id\)\)/.test(migration),
    'migration restricts organization event inserts to admins',
);

if (failed > 0) {
    console.error(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(1);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
