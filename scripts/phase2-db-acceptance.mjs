import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required for the Phase 2 database acceptance check.",
  );

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
const rollback = Symbol("rollback test fixture");
let summary;

try {
  try {
    await sql.begin(async (tx) => {
      const [holding] =
        await tx`select id from holdings where code = 'holding-group' and status = 'active' limit 1`;
      assert.ok(holding, "approved test holding must exist");
      const [defaultCompany] =
        await tx`select id from companies where holding_id = ${holding.id} and code = 'smarlux' and status = 'active' limit 1`;
      const [user] = await tx`select id from users order by id limit 1`;
      assert.ok(
        defaultCompany && user,
        "approved default company and a fixture user must exist",
      );

      const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
      const [scopedCompany] = await tx`
        insert into companies (holding_id, name, code, status)
        values (${holding.id}, 'Phase2 isolation fixture', ${`phase2_${suffix}`}, 'active') returning id
      `;
      const [foreignHolding] = await tx`
        insert into holdings (name, code, status) values ('Phase2 isolation fixture', ${`phase2_${suffix}`}, 'active') returning id
      `;
      const [foreignCompany] = await tx`
        insert into companies (holding_id, name, code, status)
        values (${foreignHolding.id}, 'Phase2 foreign fixture', ${`foreign_${suffix}`}, 'active') returning id
      `;
      const [branch] = await tx`
        insert into branches (company_id, name, code, status)
        values (${scopedCompany.id}, 'Phase2 branch fixture', ${`branch_${suffix}`}, 'active') returning id
      `;
      const [unit] = await tx`
        insert into business_units (company_id, branch_id, name, code, domain, status)
        values (${scopedCompany.id}, ${branch.id}, 'Phase2 unit fixture', ${`unit_${suffix}`}, 'test', 'active') returning id
      `;
      const [membership] = await tx`
        insert into memberships (user_id, holding_id, company_id, branch_id, business_unit_id, scope_type, status, is_default)
        values (${user.id}, ${holding.id}, ${scopedCompany.id}, ${branch.id}, ${unit.id}, 'businessUnit', 'active', false) returning id
      `;

      const [role] =
        await tx`select id from roles where holding_id = ${holding.id} and is_system = false order by id limit 1`;
      assert.ok(
        role,
        "a non-system role must exist for invitation acceptance checks",
      );
      const tokenHash =
        randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
      const invitationMobile = "09999999999";
      const [invitation] = await tx`
        insert into invitations (holding_id, company_id, mobile, token_hash, role_id, expires_at, created_by)
        values (${holding.id}, ${scopedCompany.id}, ${invitationMobile}, ${tokenHash}, ${role.id}, now() + interval '1 day', ${user.id}) returning id
      `;

      const companyRows =
        await tx`select id from companies where holding_id = ${holding.id} and status = 'active' and id = ${scopedCompany.id} order by name`;
      assert.deepEqual(
        companyRows.map((row) => row.id.toString()),
        [scopedCompany.id.toString()],
      );
      const holdingRows =
        await tx`select id from companies where holding_id = ${holding.id} and status = 'active' order by name`;
      assert.ok(
        holdingRows.some(
          (row) => row.id.toString() === scopedCompany.id.toString(),
        ),
      );
      assert.ok(
        !holdingRows.some(
          (row) => row.id.toString() === foreignCompany.id.toString(),
        ),
      );
      assert.equal(
        (
          await tx`select id from branches where id = ${branch.id} and company_id = ${scopedCompany.id} and status = 'active' limit 1`
        ).length,
        1,
      );
      assert.equal(
        (
          await tx`select id from branches where id = ${branch.id} and company_id = ${defaultCompany.id} and status = 'active' limit 1`
        ).length,
        0,
      );
      assert.equal(
        (
          await tx`select id from business_units where id = ${unit.id} and company_id = ${scopedCompany.id} and status = 'active' limit 1`
        ).length,
        1,
      );
      assert.equal(
        (
          await tx`select id from business_units where id = ${unit.id} and company_id = ${defaultCompany.id} and status = 'active' limit 1`
        ).length,
        0,
      );
      assert.equal(
        (
          await tx`select id from memberships where holding_id = ${holding.id} and company_id = ${scopedCompany.id} and status in ('active', 'pending')`
        ).length,
        1,
      );
      assert.equal(
        (
          await tx`select id from memberships where holding_id = ${holding.id} and company_id = ${defaultCompany.id} and id = ${membership.id}`
        ).length,
        0,
      );

      assert.equal(
        (
          await tx`select id from invitations where token_hash = ${tokenHash} and mobile = ${invitationMobile} and expires_at > now() and accepted_at is null and revoked_at is null`
        ).length,
        1,
        "a live invitation accepts its matching mobile and token hash",
      );
      assert.equal(
        (
          await tx`select id from invitations where token_hash = ${tokenHash} and mobile = '09888888888' and expires_at > now() and accepted_at is null and revoked_at is null`
        ).length,
        0,
        "an invitation cannot be accepted by another mobile",
      );
      const accepted =
        await tx`update invitations set accepted_at = now() where id = ${invitation.id} and token_hash = ${tokenHash} and mobile = ${invitationMobile} and expires_at > now() and accepted_at is null and revoked_at is null returning id`;
      assert.equal(
        accepted.length,
        1,
        "the first valid acceptance consumes the invitation",
      );
      const replay =
        await tx`update invitations set accepted_at = now() where id = ${invitation.id} and token_hash = ${tokenHash} and mobile = ${invitationMobile} and expires_at > now() and accepted_at is null and revoked_at is null returning id`;
      assert.equal(
        replay.length,
        0,
        "an accepted invitation cannot be replayed",
      );

      summary = {
        companyScope: "isolated",
        holdingScope: "same holding only",
        branchAndUnitScope: "isolated",
        membershipScope: "isolated",
        invitationMobileMatch: "enforced",
        invitationOneTimeAcceptance: "enforced",
      };
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    JSON.stringify({ passed: true, fixturesRolledBack: true, ...summary }),
  );
} finally {
  await sql.end();
}
