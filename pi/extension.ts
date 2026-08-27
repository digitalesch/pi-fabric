import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

export default function fabric(pi: ExtensionAPI) {
  pi.registerCommand('fabric', {
    description: 'Inspect Pi Fabric',
    handler: async (_args, ctx) => {
      ctx.ui.notify('Pi Fabric loaded', 'info');
    },
  });
}
