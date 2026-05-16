import { readFileSync } from 'fs';
import { join } from 'path';
import { safeNextPath } from '../auth-redirect';
import { canAssignOrganizationRole } from '../org-management';

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

console.log('\n-- SaaS org closeout: login redirect safety --');
assert(safeNextPath('/invite/accept?token=abc') === '/invite/accept?token=abc', 'keeps internal invite next path');
assert(safeNextPath('/audit/new') === '/audit/new', 'keeps internal app path');
assert(safeNextPath('https://evil.example/invite') === '/audit/new', 'rejects absolute external URL');
assert(safeNextPath('//evil.example/invite') === '/audit/new', 'rejects protocol-relative URL');
assert(safeNextPath('') === '/audit/new', 'falls back for empty next');

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

if (failed > 0) {
    console.error(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(1);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
