import test from "node:test";
import assert from "node:assert/strict";
import { bumpVersion, parseVersion } from "../scripts/release.mjs";

test("parses stable semantic versions only", () => {
  assert.deepEqual(parseVersion("1.2.3"), [1, 2, 3]);
  assert.throws(() => parseVersion("1.2.3-rc.1"), /stable SemVer/);
  assert.throws(() => parseVersion("01.2.3"), /stable SemVer/);
});

test("calculates patch, minor, and major releases", () => {
  assert.equal(bumpVersion("1.3.7", "patch"), "1.3.8");
  assert.equal(bumpVersion("1.3.7", "minor"), "1.4.0");
  assert.equal(bumpVersion("1.3.7", "major"), "2.0.0");
  assert.equal(bumpVersion("0.0.1", "major"), "1.0.0");
});
