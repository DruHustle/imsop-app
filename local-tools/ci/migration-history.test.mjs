import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Exact SQL bytes already released before the repository/product rename.
// Even a comment edit changes the database ledger checksum. New changes need
// a new forward migration; never update these hashes to bless edited history.
const historical = {
  "000_initial_schema.sql": "e51d9f630c504255bf80d636328137f37e682d49d8b3c65bb6eea8f4ba634dcc",
  "001_access_recovery.sql": "08214ad1a4f7eb393d44f17b602b7d8a89dd866d7e92d37ec0495028f821d8a9",
  "002_projection_reviews.sql": "513c0f85238f210a56372a74a779e23b3a80e0e65c2fcd39e77f5d24e3db9296",
  "003_projection_provenance.sql": "48439e83c535893c0c4017b03608684be50b5ef7a72aa2fb19f5d7428762f468",
  "004_delivery_forecasts.sql": "ab66826d2f10a91e026e680dccbb163b86c2ef95443f68ea8e9ff22c3ec88d56",
  "005_provisioning_audit.sql": "cf84eee1d2ed56653d70aa8599c9dcf69902da09d08c1c027a3e9fc150ebe707",
  "006_edge_observations.sql": "4e4eef3c730d405c92897a9a7da890d7d1db8c2936b3ad691a482bb59a06df6f",
  "007_immutable_mail.sql": "8e8dbda121abde898c2ae8e127569c4b406b760faf2ae6121915fa568705b0e5"
};
for (const [name, checksum] of Object.entries(historical)) {
  test(`preserves the commissioned migration bytes: ${name}`, () => {
    const file = new URL(`../../smart-logistics-backend/server/migrations/${name}`, import.meta.url);
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), checksum);
  });
}
