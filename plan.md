## Soniox AI SDK provider - third-party plan

### Goal
Publish the Soniox provider as an independent, third-party package (not a fork) that is compatible with the AI SDK provider spec and suitable for community listing.

### Scope
- repo cleanup to remove monorepo-only assumptions
- package metadata, dependencies, and docs update
- publishable build + tests
- community docs stub for PR to vercel/ai

### Plan
1. Baseline and version target
   - Confirm the AI SDK version to target (v6).
   - Verify which model spec version the provider implements (V3).

2. Package metadata and naming
   - Rename package (e.g., `@soniox/ai-sdk-provider` or `soniox-ai-sdk`).
   - Update `repository`, `bugs`, `homepage`, `keywords`, and `exports` paths.
   - Ensure `license` and `author` are correct for Soniox.

3. Dependency cleanup (workspace -> real versions)
   - Replace `workspace:*` with concrete semver ranges for:
     - `ai`
     - `@ai-sdk/provider`
     - `@ai-sdk/provider-utils`
     - `zod`
   - Align peer dependencies with the AI SDK version policy.

4. Build and tsconfig
   - Remove `@vercel/ai-tsconfig` and any workspace references.
   - Add a local `tsconfig.json` base that works standalone.
   - Ensure `tsup` config and output paths are local and correct.

5. Docs update
   - Update `README.md` to third-party language and install instructions.
   - Add a community provider doc template (for PR to AI SDK).

6. Repo hygiene
   - Add a project-level `.gitignore` suitable for Node/TS packages.
   - Remove monorepo-only artifacts if any remain.

7. Validation
   - Run tests and build locally.
   - Confirm published package installs and basic usage snippet works.
   - Test publish flow against a local Verdaccio registry.

8. Publish and community listing
   - Publish to npm with tags + changelog.
   - Submit PR to AI SDK community providers (OpenRouter template).

### Open questions
- Package name confirmed: `@soniox/ai-sdk-provider`.
- Target AI SDK version confirmed: v6.
- Initial scope: transcription only; plan to add TTS later.
