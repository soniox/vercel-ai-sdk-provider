## Testing With Verdaccio

Start Verdaccio:

```bash
npx verdaccio --config verdaccio.yaml
```

Login and publish to the local registry:

```bash
npm adduser --registry http://localhost:4873
npm run publish:local
```

Install from another project:

```bash
npm set registry http://localhost:4873
npm install @soniox/ai-sdk-provider
```

Reset the registry after testing:

```bash
npm set registry https://registry.npmjs.org/
```