/**
 * Generated-artifact projection for fabrica-skills.
 *
 * Builds the generated files from one Skill-catalog interpretation
 * (see scripts/_skill-catalog.mjs): `.claude-plugin/plugin.json` and the
 * generated sections of `schemas/run-object.schema.json`. These builders are
 * pure — filesystem reads and writes stay in the `sync-manifest.mjs`
 * orchestration at the seam.
 */
import { VALID_GATES } from './_skill-catalog.mjs';

/**
 * Build the plugin manifest document from the Skill catalog.
 * @param {any} currentPlugin The on-disk plugin document (keeps name/description).
 * @param {any} manifest The checked Skill catalog.
 * @returns {any} The generated plugin document.
 */
export function buildPluginDocument(currentPlugin, manifest) {
  return {
    name: currentPlugin.name,
    description: currentPlugin.description,
    version: manifest.repo_version,
    skills: manifest.skills.map((s) => ({
      name: s.id,
      path: `${s.path}/SKILL.md`,
    })),
  };
}

/**
 * Build the run-object schema document with generated sections
 * (current_step enum plus gate_levels) derived from the Skill catalog.
 * @param {any} schema The on-disk schema document.
 * @param {any} manifest The checked Skill catalog.
 * @returns {any} The generated schema document.
 */
export function buildSchemaDocument(schema, manifest) {
  const skillIds = manifest.skills.map((s) => s.id);

  const gateProperties = {};
  for (const s of manifest.skills) {
    if (!s.overridable && s.default_gate) {
      gateProperties[s.id] = { const: s.default_gate };
    }
  }

  const generatedSchema = JSON.parse(JSON.stringify(schema));
  generatedSchema.properties.current_step = {
    oneOf: [{ type: 'null' }, { type: 'string', enum: skillIds }],
  };
  generatedSchema.properties.gate_levels = {
    type: 'object',
    required: [...skillIds],
    propertyNames: { enum: skillIds },
    properties: gateProperties,
    additionalProperties: {
      type: 'string',
      enum: VALID_GATES,
    },
  };
  return generatedSchema;
}
