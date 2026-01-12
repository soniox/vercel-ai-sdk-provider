import { File as NodeFile } from "node:buffer";

if (!globalThis.File) {
  globalThis.File = NodeFile as unknown as typeof File;
}
