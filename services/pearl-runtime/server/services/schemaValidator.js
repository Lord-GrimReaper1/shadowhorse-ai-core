const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

let _validatorByType;

function getContractsDir() {
  // nodejs/server/services -> nodejs/server -> nodejs -> middleware -> shared/contracts
  return path.join(__dirname, '..', '..', '..', 'shared', 'contracts');
}

function loadSchema(filename) {
  const filePath = path.join(getContractsDir(), filename);
  const json = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(json);
}

function getValidators() {
  if (_validatorByType) return _validatorByType;

  const ajv = new Ajv({ allErrors: true, strict: false });

  const schemas = {
    npc: loadSchema('npc.schema.json'),
    scenario: loadSchema('scenario.schema.json'),
    faction: loadSchema('faction.schema.json'),
    region: loadSchema('region.schema.json'),
    dialogue: loadSchema('dialogue.schema.json')
  };

  _validatorByType = Object.fromEntries(
    Object.entries(schemas).map(([type, schema]) => [type, ajv.compile(schema)])
  );

  return _validatorByType;
}

function validateAsset(assetType, data) {
  const type = String(assetType || '').trim().toLowerCase();
  const validators = getValidators();
  const validate = validators[type];
  if (!validate) return { ok: true, errors: null };

  const ok = validate(data);
  return {
    ok: Boolean(ok),
    errors: validate.errors || null
  };
}

module.exports = {
  validateAsset,
};
